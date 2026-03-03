# ═══════════════════════════════════════════════════════════
# BIN Log Parser — Extract telemetry from ArduPilot .BIN logs
# ═══════════════════════════════════════════════════════════
# Uses pymavlink to read DataFlash binary logs and extract
# ATT, BAT, BARO, CTUN, GPS, STATUSTEXT, and HEARTBEAT data.

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def parse_bin_log(log_path: str | Path) -> dict:
    """
    Parse an ArduPilot .BIN log file and return structured telemetry data.

    Returns dict with keys:
        attitude, battery, altitude, speed, gps, status_messages,
        arming_events, raw_counts
    """
    from pymavlink import mavutil

    log_path = Path(log_path)
    if not log_path.exists():
        raise FileNotFoundError(f"Log file not found: {log_path}")

    logger.info(f"Parsing log: {log_path} ({log_path.stat().st_size / 1024:.1f} KB)")

    mlog = mavutil.mavlink_connection(str(log_path))

    # Accumulators
    attitude = []       # ATT messages
    battery = []        # BAT messages
    altitude = []       # BARO / CTUN altitude
    speed = []          # CTUN speed
    gps = []            # GPS messages
    status_messages = []  # STATUSTEXT
    arming_events = []  # HEARTBEAT armed transitions
    heartbeat_times = []

    last_armed = None
    msg_counts = {}

    while True:
        msg = mlog.recv_match(blocking=False)
        if msg is None:
            break

        msg_type = msg.get_type()
        msg_counts[msg_type] = msg_counts.get(msg_type, 0) + 1

        try:
            timestamp = getattr(msg, '_timestamp', 0)

            if msg_type == 'ATT':
                attitude.append({
                    "timestamp": timestamp,
                    "roll": getattr(msg, 'Roll', 0),
                    "pitch": getattr(msg, 'Pitch', 0),
                    "yaw": getattr(msg, 'Yaw', 0),
                })

            elif msg_type == 'BAT':
                battery.append({
                    "timestamp": timestamp,
                    "voltage": getattr(msg, 'Volt', 0),
                    "current": getattr(msg, 'Curr', 0),
                    "remaining": getattr(msg, 'CurrTot', None),
                })

            elif msg_type == 'BARO':
                altitude.append({
                    "timestamp": timestamp,
                    "altitude": getattr(msg, 'Alt', 0),
                    "source": "BARO",
                })

            elif msg_type == 'CTUN':
                alt_val = getattr(msg, 'Alt', None) or getattr(msg, 'DAlt', 0)
                spd_val = getattr(msg, 'Spd', None) or getattr(msg, 'DSAir', None) or 0
                altitude.append({
                    "timestamp": timestamp,
                    "altitude": alt_val,
                    "source": "CTUN",
                })
                speed.append({
                    "timestamp": timestamp,
                    "speed": spd_val,
                })

            elif msg_type == 'GPS':
                lat = getattr(msg, 'Lat', 0)
                lon = getattr(msg, 'Lng', 0)
                if lat != 0 and lon != 0:
                    gps.append({
                        "timestamp": timestamp,
                        "lat": lat,
                        "lon": lon,
                        "alt": getattr(msg, 'Alt', 0),
                        "nsats": getattr(msg, 'NSats', 0),
                        "fix": getattr(msg, 'Status', 0),
                    })

            elif msg_type == 'STATUSTEXT':
                text = getattr(msg, 'Text', '')
                severity_raw = getattr(msg, 'Severity', 6)
                # MAVLink severity: 0-3=error, 4=warn, 5-6=info
                if severity_raw <= 3:
                    severity = "error"
                elif severity_raw == 4:
                    severity = "warn"
                else:
                    severity = "info"

                status_messages.append({
                    "timestamp": timestamp,
                    "severity": severity,
                    "text": text,
                })

            elif msg_type == 'HEARTBEAT':
                heartbeat_times.append(timestamp)
                armed = bool(getattr(msg, 'armed', 0))
                if last_armed is not None and last_armed != armed:
                    arming_events.append({
                        "timestamp": timestamp,
                        "armed": armed,
                    })
                last_armed = armed

        except Exception as e:
            logger.warning(f"Error parsing {msg_type} message: {e}")
            continue

    logger.info(f"Parse complete. Message counts: {msg_counts}")
    logger.info(f"  ATT={len(attitude)}, BAT={len(battery)}, ALT={len(altitude)}, "
                f"SPD={len(speed)}, GPS={len(gps)}, STATUS={len(status_messages)}")

    return {
        "attitude": attitude,
        "battery": battery,
        "altitude": altitude,
        "speed": speed,
        "gps": gps,
        "status_messages": status_messages,
        "arming_events": arming_events,
        "raw_counts": msg_counts,
    }
