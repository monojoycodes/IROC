# ═══════════════════════════════════════════════════════════
# API Routes — All REST endpoints for the dashboard
# ═══════════════════════════════════════════════════════════
# These endpoints are READ-ONLY consumers of the state manager
# and filesystem. They never trigger computation.

import os
import json
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from core.state_manager import state_manager

router = APIRouter(prefix="/api")

# Storage paths (relative to project root)
STORAGE_DIR = Path(__file__).parent.parent / "storage"
MISSIONS_DIR = STORAGE_DIR / "missions"
LOGS_DIR = STORAGE_DIR / "logs"


# ── /api/health ───────────────────────────────────────────

@router.get("/health")
async def health():
    """Backend diagnostics — polled by dashboard StatusBar."""
    return state_manager.get_health()


# ── /api/mission/state ────────────────────────────────────

@router.get("/mission/state")
async def mission_state():
    """Lifecycle state — polled every 2s by dashboard."""
    return state_manager.get_state()


# ── /api/mission/latest ───────────────────────────────────

@router.get("/mission/latest")
async def mission_latest():
    """Return the most recently processed mission JSON."""
    mission_id = state_manager.latest_mission_id

    if not mission_id:
        # Fallback: pick the newest file in missions/ by modification time
        if MISSIONS_DIR.exists():
            files = sorted(MISSIONS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
            if files:
                return json.loads(files[0].read_text(encoding="utf-8"))

        raise HTTPException(status_code=404, detail="No mission data available.")

    path = MISSIONS_DIR / f"{mission_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Mission {mission_id} not found.")

    return json.loads(path.read_text(encoding="utf-8"))


# ── /api/mission/list ─────────────────────────────────────

@router.get("/mission/list")
async def mission_list():
    """List all stored missions for the selector dropdown."""
    if not MISSIONS_DIR.exists():
        return []

    missions = []
    for f in sorted(MISSIONS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            mission_info = data.get("mission", {})
            missions.append({
                "id": f.stem,
                "label": f"Flight {f.stem}",
                "timestamp": mission_info.get("takeoff_time", datetime.fromtimestamp(f.stat().st_mtime).isoformat()),
            })
        except (json.JSONDecodeError, OSError):
            continue

    return missions


# ── /api/mission/{id} ─────────────────────────────────────

@router.get("/mission/{mission_id}")
async def mission_by_id(mission_id: str):
    """Return a specific mission JSON by ID."""
    path = MISSIONS_DIR / f"{mission_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Mission '{mission_id}' not found.")

    return json.loads(path.read_text(encoding="utf-8"))


# ── /api/downloads/meta ───────────────────────────────────

@router.get("/downloads/meta")
async def downloads_meta():
    """Return file sizes for the download buttons."""
    mission_id = state_manager.latest_mission_id
    raw_log_mb = None
    json_mb = None

    if mission_id:
        log_path = LOGS_DIR / f"{mission_id}.bin"
        json_path = MISSIONS_DIR / f"{mission_id}.json"

        if log_path.exists():
            raw_log_mb = round(log_path.stat().st_size / (1024 * 1024), 2)
        if json_path.exists():
            json_mb = round(json_path.stat().st_size / (1024 * 1024), 2)
    else:
        # Fallback: pick newest files
        if LOGS_DIR.exists():
            logs = sorted(LOGS_DIR.glob("*.bin"), key=lambda f: f.stat().st_mtime, reverse=True)
            if logs:
                raw_log_mb = round(logs[0].stat().st_size / (1024 * 1024), 2)
        if MISSIONS_DIR.exists():
            jsons = sorted(MISSIONS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
            if jsons:
                json_mb = round(jsons[0].stat().st_size / (1024 * 1024), 2)

    return {"raw_log_mb": raw_log_mb, "json_mb": json_mb}


# ── /api/downloads/raw-log ────────────────────────────────

@router.get("/downloads/raw-log")
async def download_raw_log():
    """Serve the latest .BIN log file for download."""
    mission_id = state_manager.latest_mission_id

    if mission_id:
        path = LOGS_DIR / f"{mission_id}.bin"
        if path.exists():
            return FileResponse(path, filename=f"{mission_id}.bin", media_type="application/octet-stream")

    # Fallback: newest .bin
    if LOGS_DIR.exists():
        logs = sorted(LOGS_DIR.glob("*.bin"), key=lambda f: f.stat().st_mtime, reverse=True)
        if logs:
            return FileResponse(logs[0], filename=logs[0].name, media_type="application/octet-stream")

    raise HTTPException(status_code=404, detail="No raw log available.")


# ── /api/downloads/processed-json ─────────────────────────

@router.get("/downloads/processed-json")
async def download_processed_json():
    """Serve the latest processed mission JSON for download."""
    mission_id = state_manager.latest_mission_id

    if mission_id:
        path = MISSIONS_DIR / f"{mission_id}.json"
        if path.exists():
            return FileResponse(path, filename=f"{mission_id}.json", media_type="application/json")

    # Fallback: newest .json
    if MISSIONS_DIR.exists():
        jsons = sorted(MISSIONS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        if jsons:
            return FileResponse(jsons[0], filename=jsons[0].name, media_type="application/json")

    raise HTTPException(status_code=404, detail="No processed mission available.")


# ═══════════════════════════════════════════════════════════
# UPLOAD ENDPOINTS — Post-flight BIN + image ingestion
# ═══════════════════════════════════════════════════════════

from fastapi import UploadFile, File
from typing import List


@router.post("/upload/log")
async def upload_bin_log(file: UploadFile = File(...)):
    """
    Upload a .BIN log file and trigger the full processing pipeline.
    This is the primary post-flight workflow:
      1. User transfers .BIN from RPi/SD card to laptop
      2. User uploads via this endpoint (or drops into storage/logs/)
      3. Backend parses → computes metrics → generates JSON → ready
    """
    import asyncio

    if not file.filename.lower().endswith(".bin"):
        raise HTTPException(status_code=400, detail="Only .BIN files accepted.")

    from core.state_manager import MissionState
    current = state_manager.state
    if current in (MissionState.DOWNLOADING, MissionState.PARSING):
        raise HTTPException(status_code=409, detail=f"Pipeline already running ({current.value}).")

    # Save uploaded file
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    from datetime import datetime, timezone
    mission_id = f"FLT_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    log_path = LOGS_DIR / f"{mission_id}.bin"

    content = await file.read()
    log_path.write_bytes(content)

    # Process in background
    asyncio.create_task(_process_bin_file(mission_id, log_path))

    return {
        "status": "uploaded",
        "mission_id": mission_id,
        "file_size_kb": round(len(content) / 1024, 1),
        "message": f"Log saved. Processing started. Poll /api/mission/state to track.",
    }


async def _process_bin_file(mission_id: str, log_path):
    """Process an uploaded .BIN file through the full pipeline."""
    import asyncio
    import time
    from datetime import datetime, timezone

    try:
        state_manager.set_parsing(f"Parsing {log_path.name}…")
        parse_start = time.time()

        # Run parser in thread (CPU-bound)
        from processing.parser import parse_bin_log
        from processing.metrics import compute_metrics
        from processing.builder import build_mission_json, save_mission_json

        parsed = await asyncio.to_thread(parse_bin_log, log_path)
        metrics = compute_metrics(parsed)
        mission_data = build_mission_json(parsed, metrics, mission_id)
        save_mission_json(mission_data, mission_id, MISSIONS_DIR)

        parse_duration = time.time() - parse_start

        state_manager.set_ready(
            mission_id=mission_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            log_size_bytes=log_path.stat().st_size,
            parse_duration=parse_duration,
        )
    except Exception as e:
        state_manager.set_error(f"Failed to parse {log_path.name}: {e}")


PAYLOAD_DIR = STORAGE_DIR / "payload"


@router.post("/payload/upload")
async def upload_payload_images(files: List[UploadFile] = File(...)):
    """
    Upload payload images from the RPi.
    After landing, SCP or manually transfer images, then upload via this endpoint.
    Images are served at /payload/<filename>.
    """
    PAYLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved = []

    for f in files:
        content = await f.read()
        dest = PAYLOAD_DIR / f.filename
        dest.write_bytes(content)
        saved.append({
            "filename": f.filename,
            "size_kb": round(len(content) / 1024, 1),
            "url": f"/payload/{f.filename}",
        })

    return {"uploaded": len(saved), "files": saved}


# ═══════════════════════════════════════════════════════════
# SIMULATION ENDPOINTS — Trigger pipeline without hardware
# ═══════════════════════════════════════════════════════════

@router.post("/simulate/trigger")
async def simulate_trigger():
    """
    Trigger a full simulated mission pipeline cycle.
    Mimics what happens when a Pixhawk DISARM is detected:
      idle → downloading (with progress) → parsing → ready
    Each cycle generates a new mission with unique data.
    """
    import asyncio
    from core.state_manager import MissionState

    current = state_manager.state
    if current in (MissionState.DOWNLOADING, MissionState.PARSING):
        raise HTTPException(status_code=409, detail=f"Pipeline already running ({current.value}). Wait for completion.")

    # Run the simulation in the background
    asyncio.create_task(_run_simulated_pipeline())

    return {"status": "triggered", "message": "Simulated DISARM — pipeline starting. Poll /api/mission/state to watch progress."}


@router.post("/simulate/reset")
async def simulate_reset():
    """Reset state back to idle. Useful for testing the dashboard overlay transitions."""
    state_manager.set_idle("Reset to idle via simulation endpoint.")
    return {"status": "reset", "state": "idle"}


async def _run_simulated_pipeline():
    """Run a full simulated pipeline cycle with randomized mission data."""
    import asyncio
    import time
    import math
    import random
    from datetime import datetime, timezone, timedelta

    # Step 1: downloading (with progress animation)
    state_manager.set_downloading("Simulated: Connecting to Pixhawk…")
    await asyncio.sleep(1)

    for i in range(1, 21):
        await asyncio.sleep(0.3)
        pct = i * 5
        state_manager.update_progress(i / 20, f"Simulated download… {pct}%  ({pct * 2} KB)")

    # Step 2: parsing
    state_manager.set_parsing("Simulated: Parsing .BIN log…")
    parse_start = time.time()
    await asyncio.sleep(2)

    # Step 3: Generate unique mission data
    now = datetime.now(timezone.utc)
    mission_id = f"SIM_{now.strftime('%Y%m%d_%H%M%S')}"

    # Randomize values so each trigger produces visibly different data
    duration_s = random.randint(180, 1800)
    max_alt = round(random.uniform(20, 120), 1)
    max_spd = round(random.uniform(5, 25), 1)
    distance = random.randint(500, 8000)
    batt_start = random.randint(85, 100)
    batt_end = random.randint(10, 60)
    min_voltage = round(random.uniform(12.8, 14.5), 2)
    peak_current = round(random.uniform(15, 45), 1)

    base_time = now - timedelta(seconds=duration_s)
    dur_m, dur_s = divmod(duration_s, 60)

    def ts(offset_s):
        return (base_time + timedelta(seconds=offset_s)).isoformat()

    # GPS track (random center near Delhi)
    center_lat = 28.6139 + random.uniform(-0.01, 0.01)
    center_lon = 77.2090 + random.uniform(-0.01, 0.01)
    num_pts = 200
    gps_track = []
    for i in range(num_pts):
        t = i / num_pts
        angle = t * math.pi * 2 * 1.5
        r = 0.003 + 0.001 * math.sin(t * math.pi * 4)
        gps_track.append({
            "lat": round(center_lat + r * math.cos(angle), 6),
            "lon": round(center_lon + r * math.sin(angle), 6),
            "timestamp": ts(int(i * duration_s / num_pts)),
        })

    # Voltage curve
    voltage_curve = []
    for i in range(120):
        t = i / 120
        v = 16.8 - t * 3.2 + math.sin(t * 12) * 0.15
        voltage_curve.append({"timestamp": ts(int(i * duration_s / 120)), "voltage": round(v, 2)})

    # Altitude profile
    alt_profile = []
    for i in range(num_pts):
        t = i / num_pts
        if t < 0.1:
            alt = t * 10 * max_alt
        elif t < 0.85:
            alt = max_alt + math.sin(t * 8) * max_alt * 0.15
        else:
            alt = max_alt * (1 - (t - 0.85) / 0.15)
        alt_profile.append({"timestamp": ts(int(i * duration_s / num_pts)), "altitude": round(max(0, alt), 1)})

    # Speed profile
    spd_profile = []
    for i in range(num_pts):
        t = i / num_pts
        if t < 0.08:
            spd = t * 12.5 * max_spd
        elif t < 0.88:
            spd = max_spd * 0.8 + math.sin(t * 6) * max_spd * 0.2
        else:
            spd = max_spd * 0.8 * (1 - (t - 0.88) / 0.12)
        spd_profile.append({"timestamp": ts(int(i * duration_s / num_pts)), "speed": round(max(0, spd), 1)})

    mission_data = {
        "mission": {
            "status": random.choice(["completed", "completed", "completed", "warning"]),
            "duration": f"{dur_m}m {dur_s:02d}s",
            "duration_seconds": duration_s,
            "distance": distance,
            "max_altitude": max_alt,
            "max_speed": max_spd,
            "takeoff_time": ts(0),
            "landing_time": ts(duration_s),
        },
        "battery": {
            "start_percent": batt_start,
            "end_percent": batt_end,
            "min_voltage": min_voltage,
            "peak_current": peak_current,
            "voltage_curve": voltage_curve,
        },
        "gps": {
            "track": gps_track,
            "takeoff": gps_track[0],
            "landing": gps_track[-1],
        },
        "profile": {"altitude": alt_profile, "speed": spd_profile},
        "health": {
            "failsafe": False,
            "gps_satellites": random.randint(8, 18),
            "gps_fix": "3D Fix",
            "ekf_ok": True,
            "arming_warnings": [],
            "status_messages": [
                {"severity": "info", "text": "PreArm: Good", "timestamp": ts(-15)},
                {"severity": "info", "text": f"GPS: 3D Fix ({random.randint(8,18)} sats)", "timestamp": ts(-10)},
                {"severity": "info", "text": "EKF2 IMU0 is using GPS", "timestamp": ts(-8)},
                {"severity": "info", "text": "Armed with AUTO", "timestamp": ts(0)},
                {"severity": "warn", "text": "Vibration compensation ON", "timestamp": ts(int(duration_s * 0.07))},
                {"severity": "info", "text": "Reached waypoint #1", "timestamp": ts(int(duration_s * 0.15))},
                {"severity": "info", "text": "Reached waypoint #2", "timestamp": ts(int(duration_s * 0.35))},
                {"severity": "info", "text": "Reached waypoint #3", "timestamp": ts(int(duration_s * 0.55))},
                {"severity": "info", "text": "Reached waypoint #4", "timestamp": ts(int(duration_s * 0.75))},
                {"severity": "info", "text": "RTL initiated", "timestamp": ts(int(duration_s * 0.85))},
                {"severity": "info", "text": "Landing detected", "timestamp": ts(int(duration_s * 0.98))},
                {"severity": "info", "text": "Disarmed", "timestamp": ts(duration_s)},
            ],
        },
        "payload": {"images": []},
    }

    # Save
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    output = MISSIONS_DIR / f"{mission_id}.json"
    output.write_text(json.dumps(mission_data, indent=2, ensure_ascii=False), encoding="utf-8")

    parse_duration = time.time() - parse_start

    # Step 4: ready
    state_manager.set_ready(
        mission_id=mission_id,
        timestamp=now.isoformat(),
        log_size_bytes=output.stat().st_size,
        parse_duration=parse_duration,
    )
