# ═══════════════════════════════════════════════════════════
# State Manager — Thread-safe mission lifecycle state machine
# ═══════════════════════════════════════════════════════════
# States: idle → downloading → parsing → ready | error
# Only the backend worker may mutate state.
# API endpoints are read-only consumers.

import threading
import time
from enum import Enum


class MissionState(str, Enum):
    IDLE = "idle"
    DOWNLOADING = "downloading"
    PARSING = "parsing"
    READY = "ready"
    ERROR = "error"


class StateManager:
    """Thread-safe mission lifecycle state container."""

    def __init__(self):
        self._lock = threading.Lock()
        self._state: MissionState = MissionState.IDLE
        self._progress: float = 0.0
        self._message: str = "Waiting for flight."
        self._latest_mission_id: str | None = None
        self._last_mission_timestamp: str | None = None
        self._log_size_bytes: int = 0
        self._parse_duration_seconds: float = 0.0
        self._start_time: float = time.time()
        # Live telemetry (updated by MAVLink client)
        self._live_battery_voltage: float | None = None
        self._live_battery_percent: int | None = None
        self._live_battery_current: float | None = None
        self._live_rssi: int | None = None  # 0-255 scale
        self._live_armed: bool | None = None
        self._pixhawk_connected: bool = False
        self._live_updated_at: float | None = None
        # Attitude (gyroscope)
        self._live_roll: float = 0.0
        self._live_pitch: float = 0.0
        self._live_yaw: float = 0.0
        # Flight dynamics
        self._live_altitude: float = 0.0
        self._live_speed: float = 0.0
        self._live_heading: int = 0
        self._live_climb_rate: float = 0.0
        self._live_flight_mode: str = "UNKNOWN"

    # ── Read (thread-safe snapshots) ──────────────────────

    def get_state(self) -> dict:
        """Return current lifecycle state for the /api/mission/state endpoint."""
        with self._lock:
            return {
                "state": self._state.value,
                "progress": round(self._progress, 2),
                "message": self._message,
            }

    def get_live(self) -> dict:
        """Return live telemetry for the /api/live endpoint."""
        with self._lock:
            age = round(time.time() - self._live_updated_at, 1) if self._live_updated_at else None
            rssi_pct = None
            if self._live_rssi is not None:
                rssi_pct = min(100, max(0, round(self._live_rssi / 255 * 100)))
            return {
                "connected": self._pixhawk_connected,
                "armed": self._live_armed,
                "battery_voltage": round(self._live_battery_voltage, 2) if self._live_battery_voltage is not None else None,
                "battery_percent": self._live_battery_percent,
                "battery_current": round(self._live_battery_current, 1) if self._live_battery_current is not None else None,
                "rssi": self._live_rssi,
                "rssi_percent": rssi_pct,
                "updated_ago_seconds": age,
                # Attitude (degrees)
                "roll": round(self._live_roll, 1),
                "pitch": round(self._live_pitch, 1),
                "yaw": round(self._live_yaw, 1),
                # Flight dynamics
                "altitude": round(self._live_altitude, 1),
                "speed": round(self._live_speed, 1),
                "heading": self._live_heading,
                "climb_rate": round(self._live_climb_rate, 1),
                "flight_mode": self._live_flight_mode,
            }

    def get_health(self) -> dict:
        """Return diagnostics for the /api/health endpoint."""
        with self._lock:
            return {
                "status": "ok",
                "uptime_seconds": round(time.time() - self._start_time, 1),
                "last_mission_timestamp": self._last_mission_timestamp,
                "log_size_mb": round(self._log_size_bytes / (1024 * 1024), 2) if self._log_size_bytes else None,
                "parse_duration_seconds": round(self._parse_duration_seconds, 2) if self._parse_duration_seconds else None,
            }


    @property
    def state(self) -> MissionState:
        with self._lock:
            return self._state

    @property
    def latest_mission_id(self) -> str | None:
        with self._lock:
            return self._latest_mission_id

    # ── Write (only called by worker) ─────────────────────

    def set_pixhawk_connected(self, connected: bool):
        """Update Pixhawk connection status."""
        with self._lock:
            self._pixhawk_connected = connected

    def update_live(self, armed: bool | None = None, battery_voltage: float | None = None,
                    battery_percent: int | None = None, battery_current: float | None = None,
                    rssi: int | None = None, roll: float | None = None, pitch: float | None = None,
                    yaw: float | None = None, altitude: float | None = None, speed: float | None = None,
                    heading: int | None = None, climb_rate: float | None = None,
                    flight_mode: str | None = None):
        """Update live telemetry readings from MAVLink messages."""
        with self._lock:
            if armed is not None:
                self._live_armed = armed
            if battery_voltage is not None:
                self._live_battery_voltage = battery_voltage
            if battery_percent is not None:
                self._live_battery_percent = battery_percent
            if battery_current is not None:
                self._live_battery_current = battery_current
            if rssi is not None:
                self._live_rssi = rssi
            if roll is not None:
                self._live_roll = roll
            if pitch is not None:
                self._live_pitch = pitch
            if yaw is not None:
                self._live_yaw = yaw
            if altitude is not None:
                self._live_altitude = altitude
            if speed is not None:
                self._live_speed = speed
            if heading is not None:
                self._live_heading = heading
            if climb_rate is not None:
                self._live_climb_rate = climb_rate
            if flight_mode is not None:
                self._live_flight_mode = flight_mode
            self._live_updated_at = time.time()


    def set_downloading(self, message: str = "Downloading flight log from Pixhawk…"):
        with self._lock:
            self._state = MissionState.DOWNLOADING
            self._progress = 0.0
            self._message = message

    def update_progress(self, progress: float, message: str | None = None):
        with self._lock:
            self._progress = max(0.0, min(1.0, progress))
            if message:
                self._message = message

    def set_parsing(self, message: str = "Parsing flight data…"):
        with self._lock:
            self._state = MissionState.PARSING
            self._progress = 0.0
            self._message = message

    def set_ready(self, mission_id: str, timestamp: str, log_size_bytes: int = 0, parse_duration: float = 0.0):
        with self._lock:
            self._state = MissionState.READY
            self._progress = 1.0
            self._message = f"Mission {mission_id} ready."
            self._latest_mission_id = mission_id
            self._last_mission_timestamp = timestamp
            self._log_size_bytes = log_size_bytes
            self._parse_duration_seconds = parse_duration

    def set_error(self, message: str = "Processing failed."):
        with self._lock:
            self._state = MissionState.ERROR
            self._progress = 0.0
            self._message = message

    def set_idle(self, message: str = "Waiting for flight."):
        with self._lock:
            self._state = MissionState.IDLE
            self._progress = 0.0
            self._message = message


# Global singleton — imported by api/routes.py and workers/
state_manager = StateManager()
