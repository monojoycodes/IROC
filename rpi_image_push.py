#!/usr/bin/env python3
"""
rpi_image_push.py — RPi Image Transfer Script
==============================================
Transfers images from a folder on the Raspberry Pi to the GCS dashboard
over WiFi using HTTP multipart upload.

Usage:
    # Push all images from a folder (one-shot):
    python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.100:8000

    # Watch folder and push new images as they appear (live mode):
    python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.100:8000 --watch

Requirements (install on RPi):
    pip install requests
"""

import os
import sys
import time
import argparse
import hashlib
from pathlib import Path
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

# ── Supported image extensions ────────────────────────────────────────────────
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}


def generate_session_id():
    """Generate a unique session ID based on the current timestamp."""
    return datetime.now().strftime("SESSION_%Y%m%d_%H%M%S")


def push_image(gcs_url: str, session_id: str, image_path: Path) -> bool:
    """
    Upload a single image to the GCS backend.
    Returns True on success, False on failure.
    """
    endpoint = f"{gcs_url.rstrip('/')}/api/payload/push"
    timestamp = datetime.fromtimestamp(
        image_path.stat().st_mtime, tz=timezone.utc
    ).isoformat()

    try:
        with open(image_path, "rb") as f:
            response = requests.post(
                endpoint,
                data={
                    "session_id": session_id,
                    "filename": image_path.name,
                    "timestamp": timestamp,
                },
                files={"image": (image_path.name, f, _guess_mime(image_path))},
                timeout=30,
            )

        if response.status_code == 200:
            return True
        else:
            print(f"  ✗ {image_path.name} — HTTP {response.status_code}: {response.text[:120]}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"  ✗ Cannot reach GCS at {gcs_url}. Check WiFi and GCS IP address.")
        return False
    except requests.exceptions.Timeout:
        print(f"  ✗ {image_path.name} — Upload timed out (30s)")
        return False
    except Exception as e:
        print(f"  ✗ {image_path.name} — Unexpected error: {e}")
        return False


def _guess_mime(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".bmp": "image/bmp",
        ".webp": "image/webp", ".tiff": "image/tiff", ".tif": "image/tiff",
    }.get(ext, "application/octet-stream")


def scan_images(directory: Path) -> list[Path]:
    """Return all image files in a directory, sorted by modification time."""
    images = [
        f for f in directory.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(images, key=lambda f: f.stat().st_mtime)


def file_hash(path: Path) -> str:
    """Quick MD5 hash for change detection."""
    h = hashlib.md5()
    h.update(path.read_bytes())
    return h.hexdigest()


def push_all(directory: Path, gcs_url: str, session_id: str) -> int:
    """Push all images in the directory. Returns count of successfully uploaded images."""
    images = scan_images(directory)

    if not images:
        print(f"  No images found in {directory}")
        return 0

    print(f"\n  Found {len(images)} image(s) to upload → Session: {session_id}")
    print(f"  GCS endpoint: {gcs_url}/api/payload/push\n")

    success = 0
    for i, img in enumerate(images, 1):
        size_kb = round(img.stat().st_size / 1024, 1)
        print(f"  [{i:>3}/{len(images)}] {img.name} ({size_kb} KB) … ", end="", flush=True)
        if push_image(gcs_url, session_id, img):
            print("✓")
            success += 1
        else:
            print()  # newline after error message

    print(f"\n  ✅ Done — {success}/{len(images)} uploaded successfully.")
    return success


def watch_mode(directory: Path, gcs_url: str, session_id: str, interval: int = 3):
    """
    Watch mode: continuously monitor directory and push any new images.
    Press Ctrl+C to stop.
    """
    print(f"\n  👁  Watching {directory} for new images (every {interval}s)…")
    print(f"  Session: {session_id}")
    print(f"  Press Ctrl+C to stop.\n")

    seen: dict[str, str] = {}  # filename → hash

    # First pass — push any existing images
    for img in scan_images(directory):
        h = file_hash(img)
        size_kb = round(img.stat().st_size / 1024, 1)
        print(f"  [INIT] {img.name} ({size_kb} KB) … ", end="", flush=True)
        if push_image(gcs_url, session_id, img):
            print("✓")
            seen[img.name] = h
        else:
            print()

    # Watch loop
    try:
        while True:
            time.sleep(interval)
            try:
                current_images = scan_images(directory)
            except FileNotFoundError:
                print(f"  ✗ Directory {directory} no longer accessible.")
                continue

            for img in current_images:
                try:
                    h = file_hash(img)
                except OSError:
                    continue

                if img.name not in seen or seen[img.name] != h:
                    size_kb = round(img.stat().st_size / 1024, 1)
                    ts = datetime.now().strftime("%H:%M:%S")
                    print(f"  [{ts}] NEW {img.name} ({size_kb} KB) … ", end="", flush=True)
                    if push_image(gcs_url, session_id, img):
                        print("✓")
                        seen[img.name] = h
                    else:
                        print()

    except KeyboardInterrupt:
        print("\n\n  Stopped. Goodbye.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Push RPi images to UAV dashboard GCS over WiFi"
    )
    parser.add_argument(
        "--dir", "-d",
        required=True,
        help="Path to the folder containing images on this RPi (e.g. /home/pi/captures)"
    )
    parser.add_argument(
        "--gcs", "-g",
        required=True,
        help="GCS base URL (e.g. http://192.168.0.100:8000)"
    )
    parser.add_argument(
        "--session", "-s",
        default=None,
        help="Custom session ID (default: auto-generated from timestamp)"
    )
    parser.add_argument(
        "--watch", "-w",
        action="store_true",
        help="Watch folder for new images and push them in real-time"
    )
    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=3,
        help="Watch mode: polling interval in seconds (default: 3)"
    )

    args = parser.parse_args()

    directory = Path(args.dir)
    if not directory.exists():
        print(f"ERROR: Directory does not exist: {directory}")
        sys.exit(1)
    if not directory.is_dir():
        print(f"ERROR: Not a directory: {directory}")
        sys.exit(1)

    session_id = args.session or generate_session_id()

    print("=" * 55)
    print("  RPi Image Push — UAV Dashboard Transfer")
    print("=" * 55)
    print(f"  Source : {directory}")
    print(f"  GCS    : {args.gcs}")
    print(f"  Session: {session_id}")
    print(f"  Mode   : {'watch (live)' if args.watch else 'one-shot'}")
    print("=" * 55)

    if args.watch:
        watch_mode(directory, args.gcs, session_id, interval=args.interval)
    else:
        count = push_all(directory, args.gcs, session_id)
        sys.exit(0 if count >= 0 else 1)


if __name__ == "__main__":
    main()
