# ═══════════════════════════════════════════════════════════
# Metrics Engine — Compute derived analytics from parsed data
# ═══════════════════════════════════════════════════════════

import math
import logging

logger = logging.getLogger(__name__)


def compute_metrics(parsed: dict) -> dict:
    """
    Compute flight metrics from parsed telemetry data.

    Returns dict with:
        duration_seconds, max_altitude, max_speed, distance_meters,
        battery_start_pct, battery_end_pct, min_voltage, peak_current,
        status, takeoff_time, landing_time
    """

    altitude_data = parsed.get("altitude", [])
    speed_data = parsed.get("speed", [])
    battery_data = parsed.get("battery", [])
    gps_data = parsed.get("gps", [])
    arming_events = parsed.get("arming_events", [])

    # ── Duration ──────────────────────────────────────────
    takeoff_time = None
    landing_time = None

    # Try arming events first (most accurate)
    for evt in arming_events:
        if evt["armed"] and takeoff_time is None:
            takeoff_time = evt["timestamp"]
        elif not evt["armed"] and takeoff_time is not None:
            landing_time = evt["timestamp"]

    # Fallback: use first/last altitude data
    if takeoff_time is None and altitude_data:
        takeoff_time = altitude_data[0]["timestamp"]
    if landing_time is None and altitude_data:
        landing_time = altitude_data[-1]["timestamp"]

    duration_seconds = 0
    if takeoff_time and landing_time:
        duration_seconds = max(0, landing_time - takeoff_time)

    # ── Altitude ──────────────────────────────────────────
    max_altitude = 0.0
    if altitude_data:
        max_altitude = max(d["altitude"] for d in altitude_data)

    # ── Speed ─────────────────────────────────────────────
    max_speed = 0.0
    if speed_data:
        max_speed = max(d["speed"] for d in speed_data)

    # ── Distance (GPS track haversine sum) ────────────────
    distance_meters = 0.0
    if len(gps_data) >= 2:
        for i in range(1, len(gps_data)):
            distance_meters += _haversine(
                gps_data[i - 1]["lat"], gps_data[i - 1]["lon"],
                gps_data[i]["lat"], gps_data[i]["lon"],
            )

    # ── Battery ───────────────────────────────────────────
    min_voltage = None
    peak_current = 0.0
    battery_start_pct = None
    battery_end_pct = None

    if battery_data:
        voltages = [d["voltage"] for d in battery_data if d["voltage"] > 0]
        currents = [d["current"] for d in battery_data if d["current"] is not None]

        if voltages:
            min_voltage = min(voltages)
            # Estimate percent from voltage (4S LiPo: 16.8V=100%, 13.2V=0%)
            battery_start_pct = _voltage_to_percent(voltages[0])
            battery_end_pct = _voltage_to_percent(voltages[-1])

        if currents:
            peak_current = max(currents)

    # ── Mission status ────────────────────────────────────
    status = "completed"
    status_messages = parsed.get("status_messages", [])
    for msg in status_messages:
        if msg["severity"] == "error":
            status = "warning"
            break

    # Check for failsafe
    for msg in status_messages:
        if "failsafe" in msg.get("text", "").lower():
            status = "warning"

    return {
        "duration_seconds": round(duration_seconds, 1),
        "max_altitude": round(max_altitude, 1),
        "max_speed": round(max_speed, 1),
        "distance_meters": round(distance_meters, 0),
        "battery_start_pct": battery_start_pct,
        "battery_end_pct": battery_end_pct,
        "min_voltage": round(min_voltage, 2) if min_voltage else None,
        "peak_current": round(peak_current, 1),
        "status": status,
        "takeoff_time": takeoff_time,
        "landing_time": landing_time,
    }


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lon points."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _voltage_to_percent(voltage: float, cells: int = 4) -> int:
    """Estimate LiPo battery percent from voltage (4S default)."""
    per_cell = voltage / cells
    # LiPo per-cell voltage curve (simplified)
    if per_cell >= 4.20:
        return 100
    elif per_cell <= 3.30:
        return 0
    else:
        # Linear approximation between 3.30V (0%) and 4.20V (100%)
        return int(round((per_cell - 3.30) / 0.90 * 100))
