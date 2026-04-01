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
        self._mav = None  # Store connection for explicit cleanup

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
        """Stop the listener thread and release the COM port."""
        self._running = False
        # Explicitly close the MAVLink/serial connection
        if self._mav:
            try:
                self._mav.close()
            except Exception:
                pass
            self._mav = None
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
                # Mark as disconnected
                try:
                    from core.state_manager import state_manager
                    state_manager.set_pixhawk_connected(False)
                except Exception:
                    pass
                # Close connection on error too
                if self._mav:
                    try:
                        self._mav.close()
                    except Exception:
                        pass
                    self._mav = None
                time.sleep(5)


    def _connect_and_listen(self):
        """Connect to vehicle and monitor heartbeats + live telemetry."""
        from pymavlink import mavutil
        from core.state_manager import state_manager
        import math

        # ArduCopter flight mode mapping (custom_mode → name)
        COPTER_MODES = {
            0: "STABILIZE", 1: "ACRO", 2: "ALT_HOLD", 3: "AUTO",
            4: "GUIDED", 5: "LOITER", 6: "RTL", 7: "CIRCLE",
            9: "LAND", 11: "DRIFT", 13: "SPORT", 14: "FLIP",
            15: "AUTOTUNE", 16: "POSHOLD", 17: "BRAKE", 18: "THROW",
            19: "AVOID_ADSB", 20: "GUIDED_NOGPS", 21: "SMART_RTL",
            22: "FLOWHOLD", 23: "FOLLOW", 24: "ZIGZAG", 25: "SYSTEMID",
            26: "AUTOROTATE", 27: "AUTO_RTL",
        }

        logger.info(f"Connecting to {self.connection_string}…")
        self._mav = mavutil.mavlink_connection(self.connection_string, baud=57600)

        logger.info("Waiting for heartbeat…")
        self._mav.wait_heartbeat(timeout=30)
        logger.info(f"Heartbeat received (system {self._mav.target_system}, component {self._mav.target_component})")

        state_manager.set_pixhawk_connected(True)
        self._last_armed = None

        while self._running:
            msg = self._mav.recv_match(
                type=['HEARTBEAT', 'SYS_STATUS', 'ATTITUDE', 'VFR_HUD',
                      'RC_CHANNELS', 'RC_CHANNELS_RAW'],
                blocking=True,
                timeout=5
            )
            if msg is None:
                continue

            msg_type = msg.get_type()

            if msg_type == 'HEARTBEAT':
                armed = bool(msg.base_mode & 128)  # MAV_MODE_FLAG_SAFETY_ARMED
                # Decode flight mode
                mode_num = getattr(msg, 'custom_mode', 0)
                mode_name = COPTER_MODES.get(mode_num, f"MODE_{mode_num}")
                state_manager.update_live(armed=armed, flight_mode=mode_name)

                if self._last_armed is True and armed is False:
                    logger.info("🔴 DISARM detected — triggering mission processing")
                    if self._on_disarm:
                        self._on_disarm()

                self._last_armed = armed

            elif msg_type == 'SYS_STATUS':
                voltage = getattr(msg, 'voltage_battery', None)
                current = getattr(msg, 'current_battery', None)
                remaining = getattr(msg, 'battery_remaining', None)
                state_manager.update_live(
                    battery_voltage=voltage / 1000.0 if voltage and voltage > 0 else None,
                    battery_current=current / 100.0 if current and current >= 0 else None,
                    battery_percent=remaining if remaining and remaining >= 0 else None,
                )

            elif msg_type == 'ATTITUDE':
                # ATTITUDE gives roll/pitch/yaw in radians — convert to degrees
                state_manager.update_live(
                    roll=math.degrees(getattr(msg, 'roll', 0)),
                    pitch=math.degrees(getattr(msg, 'pitch', 0)),
                    yaw=math.degrees(getattr(msg, 'yaw', 0)),
                )

            elif msg_type == 'VFR_HUD':
                state_manager.update_live(
                    altitude=getattr(msg, 'alt', 0),
                    speed=getattr(msg, 'groundspeed', 0),
                    heading=getattr(msg, 'heading', 0),
                    climb_rate=getattr(msg, 'climb', 0),
                )

            elif msg_type in ('RC_CHANNELS', 'RC_CHANNELS_RAW'):
                rssi = getattr(msg, 'rssi', None)
                if rssi is not None and rssi != 255:
                    state_manager.update_live(rssi=rssi)



