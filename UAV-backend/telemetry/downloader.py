# ═══════════════════════════════════════════════════════════
# Log Downloader — Download .BIN logs from Pixhawk
# ═══════════════════════════════════════════════════════════
# Uses MAVLink LOG_REQUEST_LIST and LOG_REQUEST_DATA to
# retrieve the latest flight log from the flight controller.

import logging
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)


def download_latest_log(
    connection_string: str,
    output_path: str | Path,
    progress_callback: Callable[[float, str], None] | None = None,
) -> Path:
    """
    Download the latest .BIN log from the Pixhawk flight controller.

    Args:
        connection_string: MAVLink connection string (serial/UDP)
        output_path: Path to save the .bin file
        progress_callback: Optional (progress_0_to_1, message) callback

    Returns:
        Path to the downloaded file
    """
    from pymavlink import mavutil

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Connecting for log download: {connection_string}")
    mav = mavutil.mavlink_connection(connection_string, baud=57600)

    try:
        mav.wait_heartbeat(timeout=30)
        logger.info("Connected. Requesting log list…")

        if progress_callback:
            progress_callback(0.05, "Connected to Pixhawk. Requesting log list…")

        # Request log list
        mav.mav.log_request_list_send(
            mav.target_system, mav.target_component,
            0, 0xFFFF  # all logs
        )

        # Wait for log entries
        logs = []
        while True:
            msg = mav.recv_match(type='LOG_ENTRY', blocking=True, timeout=10)
            if msg is None:
                break
            logs.append({
                "id": msg.id,
                "size": msg.size,
                "num_logs": msg.num_logs,
                "last_log_num": msg.last_log_num,
            })
            if msg.id == msg.last_log_num:
                break

        if not logs:
            raise RuntimeError("No logs found on flight controller.")

        # Pick the latest log (highest ID)
        latest = max(logs, key=lambda x: x["id"])
        log_id = latest["id"]
        log_size = latest["size"]

        logger.info(f"Downloading log #{log_id} ({log_size / 1024:.1f} KB)")
        if progress_callback:
            progress_callback(0.1, f"Downloading log #{log_id} ({log_size / 1024:.1f} KB)…")

        # Request log data
        mav.mav.log_request_data_send(
            mav.target_system, mav.target_component,
            log_id, 0, log_size
        )

        # Receive data with retry logic
        received = bytearray()
        max_retries = 5
        retry_count = 0
        stall_timeout = 30  # seconds per packet (telemetry radios are slow)

        while len(received) < log_size:
            msg = mav.recv_match(type='LOG_DATA', blocking=True, timeout=stall_timeout)
            if msg is None:
                retry_count += 1
                if retry_count > max_retries:
                    logger.warning(f"Download stalled after {max_retries} retries. Got {len(received)}/{log_size} bytes.")
                    break

                # Re-request data from where we left off
                offset = len(received)
                remaining = log_size - offset
                logger.info(f"Download stalled at {offset}/{log_size} bytes. Retry {retry_count}/{max_retries} — re-requesting from offset {offset}…")

                if progress_callback:
                    pct = int(offset / log_size * 100)
                    progress_callback(
                        min(0.95, 0.1 + 0.85 * offset / log_size),
                        f"Stalled at {pct}%. Retrying ({retry_count}/{max_retries})…"
                    )

                mav.mav.log_request_data_send(
                    mav.target_system, mav.target_component,
                    log_id, offset, remaining
                )
                continue

            # Got data — reset retry counter
            retry_count = 0
            data = bytes(msg.data[:msg.count])
            received.extend(data)

            # Update progress
            progress = min(0.95, 0.1 + 0.85 * len(received) / log_size)
            if progress_callback:
                pct = int(len(received) / log_size * 100)
                progress_callback(progress, f"Downloading… {pct}%  ({len(received) / 1024:.0f} KB)")

        # Validate download
        if len(received) < log_size * 0.5:
            raise RuntimeError(
                f"Download incomplete: got {len(received)}/{log_size} bytes "
                f"({len(received) * 100 // log_size}%). Log file too corrupt to parse."
            )

        # Save to file
        output_path.write_bytes(received)
        logger.info(f"Log saved: {output_path} ({len(received)} bytes)")

        if progress_callback:
            progress_callback(1.0, f"Download complete. {len(received) / 1024:.1f} KB saved.")

        return output_path

    finally:
        # Always close the connection to release the COM port
        try:
            mav.close()
        except Exception:
            pass

