# ═══════════════════════════════════════════════════════════
# MAVLink Client — Heartbeat listener for DISARM detection
# ═══════════════════════════════════════════════════════════
# Connects to Pixhawk via serial or UDP and watches for
# armed → disarmed transitions to trigger mission processing.

import time
import logging
import threading
from typing import Callable

logger = logging.getLogger(__name__)


class MAVLinkClient:
    """
    MAVLink heartbeat listener.

    Monitors the vehicle's armed state and fires a callback
    when DISARM is detected (indicating landing).
    """

    def __init__(self, connection_string: str = "udp:127.0.0.1:14550"):
        self.connection_string = connection_string
        self._running = False
        self._thread: threading.Thread | None = None
        self._on_disarm: Callable | None = None
        self._last_armed: bool | None = None

    def set_disarm_callback(self, callback: Callable):
        """Register callback to fire on DISARM detection."""
        self._on_disarm = callback

    def start(self):
        """Start listening in a background thread."""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.info(f"MAVLink client started: {self.connection_string}")

    def stop(self):
        """Stop the listener thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            logger.info("MAVLink client stopped.")

    def _listen_loop(self):
        """Main listen loop — connects and watches heartbeats."""
        while self._running:
            try:
                self._connect_and_listen()
            except Exception as e:
                logger.warning(f"MAVLink connection error: {e}. Reconnecting in 5s…")
                time.sleep(5)

    def _connect_and_listen(self):
        """Connect to vehicle and monitor heartbeats."""
        from pymavlink import mavutil

        logger.info(f"Connecting to {self.connection_string}…")
        mav = mavutil.mavlink_connection(self.connection_string, baud=57600)

        logger.info("Waiting for heartbeat…")
        mav.wait_heartbeat(timeout=30)
        logger.info(f"Heartbeat received (system {mav.target_system}, component {mav.target_component})")

        self._last_armed = None

        while self._running:
            msg = mav.recv_match(type='HEARTBEAT', blocking=True, timeout=5)
            if msg is None:
                continue

            # Check armed state from base_mode bitmask
            armed = bool(msg.base_mode & 128)  # MAV_MODE_FLAG_SAFETY_ARMED

            if self._last_armed is True and armed is False:
                # DISARM detected — landing event
                logger.info("🔴 DISARM detected — triggering mission processing")
                if self._on_disarm:
                    self._on_disarm()

            self._last_armed = armed
