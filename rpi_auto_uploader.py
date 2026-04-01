#!/usr/bin/env python3
"""
RPi Auto-Uploader Daemon
Run this script on your Raspberry Pi on boot (e.g., via systemd).
It continuously tries to reach the GCS (Ground Control Station) backend.
Once the drone lands and connects to the GCS WiFi, this script will:
1. Automatically find all images and the detection_log.json.
2. Upload them to the backend in a batch.
3. Move the uploaded files to an 'archive' folder so they aren't uploaded twice.
"""

import os
import time
import shutil
import glob
import requests
from datetime import datetime

# ── Configuration ───────────────
# Change this to the Static IP of your Ground Control Laptop on the hotspot network
GCS_BACKEND_URL = "http://192.168.1.100:8000"
POLL_INTERVAL_SECONDS = 5

# Where your ML script saves the detections on the RPi during flight
DETECTIONS_DIR = "/home/pi/ai-vision/detections"
IMAGES_DIR = "/home/pi/ai-vision/images"

# Where to move them after successful upload
ARCHIVE_DIR = "/home/pi/ai-vision/archive"
# ────────────────────────────────

def check_connection():
    """Returns True if the GCS backend is reachable."""
    try:
        res = requests.get(f"{GCS_BACKEND_URL}/api/health", timeout=2)
        return res.status_code == 200
    except requests.RequestException:
        return False

def upload_detections():
    """Finds new detections and uploads them."""
    log_file = os.path.join(DETECTIONS_DIR, "log.json")
    if not os.path.exists(log_file):
        return  # Nothing to upload

    # Find all images
    image_files = glob.glob(os.path.join(IMAGES_DIR, "*.jpg"))
    if not image_files:
        return  # No images

    print(f"[{datetime.now()}] Connection established! Uploading {len(image_files)} images...")

    # Prepare multipart form data
    files = [
        ("detection_log", ("log.json", open(log_file, "rb"), "application/json"))
    ]
    
    # Add all images to the form
    for img_path in image_files:
        files.append(
            ("images", (os.path.basename(img_path), open(img_path, "rb"), "image/jpeg"))
        )

    # Use a dummy sortie ID or read it if your ML script captures it
    data = {"sortie_id": "S_AUTO"}

    try:
        response = requests.post(
            f"{GCS_BACKEND_URL}/api/detections/batch",
            data=data,
            files=files,
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"[{datetime.now()}] Upload successful: {response.json()}")
            archive_files(log_file, image_files)
        else:
            print(f"[{datetime.now()}] Upload failed with status {response.status_code}: {response.text}")
            
    except requests.RequestException as e:
        print(f"[{datetime.now()}] Upload interrupted: {e}")
    finally:
        # Close all opened files
        for f in files:
            f[1][1].close()

def archive_files(log_file, image_files):
    """Moves successfully uploaded files to an archive directory."""
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    
    # Create a unique timestamped folder for this batch
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_archive = os.path.join(ARCHIVE_DIR, timestamp)
    os.makedirs(batch_archive, exist_ok=True)
    
    # Move log
    shutil.move(log_file, os.path.join(batch_archive, "log.json"))
    
    # Move images
    archive_img_dir = os.path.join(batch_archive, "images")
    os.makedirs(archive_img_dir, exist_ok=True)
    for img in image_files:
        shutil.move(img, os.path.join(archive_img_dir, os.path.basename(img)))
        
    print(f"[{datetime.now()}] Files archived to {batch_archive}")

if __name__ == "__main__":
    print(f"Starting RPi Auto-Uploader Daemon...")
    print(f"Waiting for GCS connection at {GCS_BACKEND_URL}")
    os.makedirs(DETECTIONS_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    while True:
        if check_connection():
            upload_detections()
        time.sleep(POLL_INTERVAL_SECONDS)
