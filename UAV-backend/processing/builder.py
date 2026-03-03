# ═══════════════════════════════════════════════════════════
# Mission Builder — Assemble JSON matching frontend schema
# ═══════════════════════════════════════════════════════════
# Produces the exact JSON shape expected by the React dashboard
# as defined in mockMission.js.

import json
import logging
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def build_mission_json(parsed: dict, metrics: dict, mission_id: str) -> dict:
    """
    Build mission JSON matching the frontend mockMission.js schema.

    Args:
        parsed: Raw parsed telemetry from parser.py
        metrics: Computed metrics from metrics.py
        mission_id: Unique mission identifier

    Returns:
        dict matching frontend contract
    """

    # ── Time formatting ───────────────────────────────────

    def ts_to_iso(ts):
        """Convert Unix timestamp to ISO 8601 string."""
        if ts is None:
            return None
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        except (OSError, ValueError):
            return None

    takeoff_iso = ts_to_iso(metrics["takeoff_time"])
    landing_iso = ts_to_iso(metrics["landing_time"])

    # ── Duration formatting ───────────────────────────────
    dur = int(metrics["duration_seconds"])
    minutes, seconds = divmod(dur, 60)
    duration_str = f"{minutes}m {seconds:02d}s"

    # ── Mission section ───────────────────────────────────
    mission = {
        "status": metrics["status"],
        "duration": duration_str,
        "duration_seconds": metrics["duration_seconds"],
        "distance": metrics["distance_meters"],
        "max_altitude": metrics["max_altitude"],
        "max_speed": metrics["max_speed"],
        "takeoff_time": takeoff_iso,
        "landing_time": landing_iso,
    }

    # ── Battery section ───────────────────────────────────
    battery_data = parsed.get("battery", [])
    voltage_curve = []
    for d in battery_data:
        voltage_curve.append({
            "timestamp": ts_to_iso(d["timestamp"]),
            "voltage": round(d["voltage"], 2),
        })

    battery = {
        "start_percent": metrics["battery_start_pct"] if metrics["battery_start_pct"] is not None else 100,
        "end_percent": metrics["battery_end_pct"] if metrics["battery_end_pct"] is not None else 0,
        "min_voltage": metrics["min_voltage"] if metrics["min_voltage"] else 0,
        "peak_current": metrics["peak_current"],
        "voltage_curve": voltage_curve,
    }

    # ── GPS section ───────────────────────────────────────
    gps_data = parsed.get("gps", [])
    gps_track = []
    for d in gps_data:
        gps_track.append({
            "lat": d["lat"],
            "lon": d["lon"],
            "timestamp": ts_to_iso(d["timestamp"]),
        })

    gps = {
        "track": gps_track,
        "takeoff": gps_track[0] if gps_track else None,
        "landing": gps_track[-1] if gps_track else None,
    }

    # ── Profile section (altitude + speed time-series) ────
    altitude_data = parsed.get("altitude", [])
    altitude_profile = []
    for d in altitude_data:
        altitude_profile.append({
            "timestamp": ts_to_iso(d["timestamp"]),
            "altitude": round(d["altitude"], 1),
        })

    speed_data = parsed.get("speed", [])
    speed_profile = []
    for d in speed_data:
        speed_profile.append({
            "timestamp": ts_to_iso(d["timestamp"]),
            "speed": round(d["speed"], 1),
        })

    profile = {
        "altitude": altitude_profile,
        "speed": speed_profile,
    }

    # ── Health section ────────────────────────────────────
    status_messages = parsed.get("status_messages", [])
    formatted_messages = []
    for msg in status_messages:
        formatted_messages.append({
            "severity": msg["severity"],
            "text": msg["text"],
            "timestamp": ts_to_iso(msg["timestamp"]),
        })

    # Detect failsafe
    failsafe = any("failsafe" in m.get("text", "").lower() for m in status_messages)

    # GPS quality from last GPS data
    gps_satellites = 0
    gps_fix = "No Fix"
    if gps_data:
        last_gps = gps_data[-1]
        gps_satellites = last_gps.get("nsats", 0)
        fix_type = last_gps.get("fix", 0)
        gps_fix = {0: "No Fix", 1: "No Fix", 2: "2D Fix", 3: "3D Fix"}.get(fix_type, f"Fix {fix_type}")

    # Arming warnings from status messages
    arming_warnings = [m["text"] for m in status_messages if "prearm" in m.get("text", "").lower()]

    health = {
        "failsafe": failsafe,
        "gps_satellites": gps_satellites,
        "gps_fix": gps_fix,
        "ekf_ok": not any("ekf" in m.get("text", "").lower() and m["severity"] == "error" for m in status_messages),
        "arming_warnings": arming_warnings,
        "status_messages": formatted_messages,
    }

    # ── Payload section (images detected in storage) ──────
    payload = {
        "images": [],
    }

    # ── Assemble ──────────────────────────────────────────
    return {
        "mission": mission,
        "battery": battery,
        "gps": gps,
        "profile": profile,
        "health": health,
        "payload": payload,
    }


def save_mission_json(mission_data: dict, mission_id: str, output_dir: str | Path) -> Path:
    """Save mission JSON to storage/missions/<id>.json."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"{mission_id}.json"
    output_path.write_text(json.dumps(mission_data, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"Mission JSON saved: {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")

    return output_path
