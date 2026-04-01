# ═══════════════════════════════════════════════════════════
# Mission Worker — Background pipeline orchestrator
# ═══════════════════════════════════════════════════════════
# Runs as an asyncio background task. Drives the full pipeline:
#   idle → downloading → parsing → ready (or error)
#
# Two modes:
#   1. LIVE — Uses MAVLink client to detect DISARM and download logs
#   2. SIMULATION — Auto-generates sample mission for development

import asyncio
import time
import json
import math
import logging
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta

from core.state_manager import state_manager, MissionState

logger = logging.getLogger(__name__)

STORAGE_DIR = Path(__file__).parent.parent / "storage"
MISSIONS_DIR = STORAGE_DIR / "missions"
LOGS_DIR = STORAGE_DIR / "logs"


async def start_mission_worker(connection_string: str | None = None):
    """
    Start the background mission worker.

    If connection_string is provided, runs in LIVE mode with MAVLink.
    Otherwise, runs in SIMULATION mode and generates sample data.
    """
    if connection_string:
        await _run_live_worker(connection_string)
    else:
        await _run_simulation_worker()


# ═══════════════════════════════════════════════════════════
# SIMULATION MODE — For development without hardware
# ═══════════════════════════════════════════════════════════

async def _run_simulation_worker():
    """
    Simulate a mission pipeline cycle for dashboard development.
    Generates a realistic sample mission and saves it as JSON.
    """
    logger.info("🧪 Starting SIMULATION worker (no MAVLink connection)")

    # Check if any mission already exists
    if MISSIONS_DIR.exists() and list(MISSIONS_DIR.glob("*.json")):
        existing = sorted(MISSIONS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
        mission_id = existing[0].stem
        state_manager.set_ready(
            mission_id=mission_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            log_size_bytes=existing[0].stat().st_size,
            parse_duration=0.0,
        )
        logger.info(f"Existing mission found: {mission_id}. State set to READY.")
        return

    # Simulate the full pipeline cycle
    logger.info("No existing missions. Running simulation cycle…")

    # Step 1: idle → downloading
    await asyncio.sleep(2)
    state_manager.set_downloading("Simulated: Downloading flight log…")
    logger.info("State → DOWNLOADING")

    # Simulate download progress
    for i in range(1, 11):
        await asyncio.sleep(0.5)
        state_manager.update_progress(i / 10, f"Simulated download… {i * 10}%")

    # Step 2: downloading → parsing
    state_manager.set_parsing("Simulated: Parsing flight data…")
    logger.info("State → PARSING")
    parse_start = time.time()

    await asyncio.sleep(2)  # Simulate parse time

    # Step 3: Generate sample mission data
    mission_id = f"SIM_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    mission_data = _generate_sample_mission()

    # Save
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = MISSIONS_DIR / f"{mission_id}.json"
    output_path.write_text(json.dumps(mission_data, indent=2, ensure_ascii=False), encoding="utf-8")

    parse_duration = time.time() - parse_start
    logger.info(f"Sample mission saved: {output_path}")

    # Step 4: parsing → ready
    state_manager.set_ready(
        mission_id=mission_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        log_size_bytes=output_path.stat().st_size,
        parse_duration=parse_duration,
    )
    logger.info(f"State → READY (mission: {mission_id})")


def _generate_sample_mission() -> dict:
    """Generate a realistic sample mission matching the frontend schema."""
    now = datetime.now(timezone.utc)
    base_time = now - timedelta(minutes=10)
    duration_seconds = 600  # 10 minutes

    def ts(offset_s: int) -> str:
        return (base_time + timedelta(seconds=offset_s)).isoformat()

    # GPS track (circular pattern over Delhi area)
    center_lat, center_lon = 28.6139, 77.2090
    num_gps_points = 200
    gps_track = []
    for i in range(num_gps_points):
        t = i / num_gps_points
        angle = t * math.pi * 2 * 1.5
        radius = 0.003 + 0.001 * math.sin(t * math.pi * 4)
        gps_track.append({
            "lat": round(center_lat + radius * math.cos(angle), 6),
            "lon": round(center_lon + radius * math.sin(angle), 6),
            "timestamp": ts(int(i * 3)),
        })

    # Voltage curve
    voltage_curve = []
    for i in range(120):
        t = i / 120
        v = 16.8 - t * 3.2 + math.sin(t * 12) * 0.15
        voltage_curve.append({
            "timestamp": ts(int(i * 5)),
            "voltage": round(v, 2),
        })

    # Altitude profile
    altitude_profile = []
    for i in range(200):
        t = i / 200
        if t < 0.1:
            alt = t * 10 * 45
        elif t < 0.85:
            alt = 45 + math.sin(t * 8) * 10
        else:
            alt = 45 * (1 - (t - 0.85) / 0.15)
        altitude_profile.append({
            "timestamp": ts(int(i * 3)),
            "altitude": round(max(0, alt), 1),
        })

    # Speed profile
    speed_profile = []
    for i in range(200):
        t = i / 200
        if t < 0.08:
            spd = t * 12.5 * 12
        elif t < 0.88:
            spd = 12 + math.sin(t * 6) * 3
        else:
            spd = 12 * (1 - (t - 0.88) / 0.12)
        speed_profile.append({
            "timestamp": ts(int(i * 3)),
            "speed": round(max(0, spd), 1),
        })

    return {
        "mission": {
            "status": "completed",
            "duration": "10m 00s",
            "duration_seconds": duration_seconds,
            "distance": 2847,
            "max_altitude": 54.8,
            "max_speed": 15.3,
            "takeoff_time": ts(0),
            "landing_time": ts(duration_seconds),
        },
        "battery": {
            "start_percent": 98,
            "end_percent": 42,
            "min_voltage": 13.62,
            "peak_current": 28.4,
            "voltage_curve": voltage_curve,
        },
        "gps": {
            "track": gps_track,
            "takeoff": gps_track[0],
            "landing": gps_track[-1],
        },
        "profile": {
            "altitude": altitude_profile,
            "speed": speed_profile,
        },
        "health": {
            "failsafe": False,
            "gps_satellites": 14,
            "gps_fix": "3D Fix",
            "ekf_ok": True,
            "arming_warnings": [],
            "status_messages": [
                {"severity": "info", "text": "PreArm: Good", "timestamp": ts(-15)},
                {"severity": "info", "text": "GPS: 3D Fix (14 sats)", "timestamp": ts(-10)},
                {"severity": "info", "text": "EKF2 IMU0 is using GPS", "timestamp": ts(-8)},
                {"severity": "info", "text": "Armed with AUTO", "timestamp": ts(0)},
                {"severity": "warn", "text": "Vibration compensation ON", "timestamp": ts(45)},
                {"severity": "info", "text": "Reached waypoint #1", "timestamp": ts(90)},
                {"severity": "info", "text": "Reached waypoint #2", "timestamp": ts(180)},
                {"severity": "info", "text": "Reached waypoint #3", "timestamp": ts(310)},
                {"severity": "info", "text": "Reached waypoint #4", "timestamp": ts(420)},
                {"severity": "info", "text": "RTL initiated", "timestamp": ts(500)},
                {"severity": "info", "text": "Landing detected", "timestamp": ts(595)},
                {"severity": "info", "text": "Disarmed", "timestamp": ts(600)},
            ],
        },
        "payload": {
            "images": [],
        },
    }


# ═══════════════════════════════════════════════════════════
# LIVE MODE — Real MAVLink pipeline
# ═══════════════════════════════════════════════════════════

async def _run_live_worker(connection_string: str):
    """Run the real MAVLink pipeline: detect DISARM → download → parse → save."""
    from telemetry.mavlink_client import MAVLinkClient
    from telemetry.downloader import download_latest_log
    from processing.parser import parse_bin_log
    from processing.metrics import compute_metrics
    from processing.builder import build_mission_json, save_mission_json

    logger.info(f"🔌 Starting LIVE worker: {connection_string}")

    disarm_event = asyncio.Event()
    loop = asyncio.get_event_loop()

    def on_disarm():
        """Called from MAVLink thread when DISARM detected."""
        loop.call_soon_threadsafe(disarm_event.set)

    # Start MAVLink listener
    client = MAVLinkClient(connection_string)
    client.set_disarm_callback(on_disarm)
    client.start()

    state_manager.set_idle("Connected. Waiting for flight…")

    try:
        while True:
            # Wait for landing
            await disarm_event.wait()
            disarm_event.clear()
            logger.info("DISARM event received — starting pipeline")

            # Stop MAVLink listener to release the COM port for downloading
            logger.info("Stopping MAVLink listener to free COM port…")
            client.stop()
            await asyncio.sleep(3)  # Give Windows time to fully release the COM port

            try:
                # Generate mission ID
                mission_id = f"FLT_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

                # Step 1: Download
                state_manager.set_downloading("Downloading flight log from Pixhawk…")
                log_path = LOGS_DIR / f"{mission_id}.bin"

                def on_progress(progress, message):
                    state_manager.update_progress(progress, message)

                await asyncio.to_thread(
                    download_latest_log,
                    connection_string,
                    log_path,
                    on_progress,
                )

                log_size = log_path.stat().st_size
                logger.info(f"Log downloaded: {log_path} ({log_size / 1024:.1f} KB)")

                # Step 2: Parse
                state_manager.set_parsing("Parsing flight data…")
                parse_start = time.time()

                parsed = await asyncio.to_thread(parse_bin_log, log_path)

                # Step 3: Compute metrics
                metrics = compute_metrics(parsed)

                # Step 4: Build and save JSON
                mission_data = build_mission_json(parsed, metrics, mission_id)
                save_mission_json(mission_data, mission_id, MISSIONS_DIR)

                parse_duration = time.time() - parse_start

                # Step 5: Ready
                state_manager.set_ready(
                    mission_id=mission_id,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    log_size_bytes=log_size,
                    parse_duration=parse_duration,
                )
                logger.info(f"Pipeline complete: {mission_id} ({parse_duration:.1f}s)")

            except Exception as e:
                logger.error(f"Pipeline error: {e}", exc_info=True)
                state_manager.set_error(f"Processing failed: {e}")

            # Wait before restarting listener — prevents false DISARM detection
            # The Pixhawk is still disarmed, so restarting too soon would pick up
            # a stale armed→disarmed transition from the heartbeat stream
            logger.info("Waiting 10s before restarting MAVLink listener (debounce)…")
            await asyncio.sleep(10)

            # Clear any stale disarm events that fired during the wait
            disarm_event.clear()

            # Restart MAVLink listener for next flight
            logger.info("Restarting MAVLink listener…")
            client = MAVLinkClient(connection_string)
            client.set_disarm_callback(on_disarm)
            client.start()

            # Wait for listener to stabilize, then clear any false events
            await asyncio.sleep(5)
            disarm_event.clear()
            logger.info("Listener stabilized. Ready for next flight.")

    finally:
        client.stop()
