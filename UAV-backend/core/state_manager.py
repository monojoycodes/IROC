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

    # ── Read (thread-safe snapshots) ──────────────────────

    def get_state(self) -> dict:
        """Return current lifecycle state for the /api/mission/state endpoint."""
        with self._lock:
            return {
                "state": self._state.value,
                "progress": round(self._progress, 2),
                "message": self._message,
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
