# RPi → Dashboard Image Transfer Guide

A step-by-step guide for transferring images captured on the Raspberry Pi to the UAV Ground Control Station (GCS) dashboard over WiFi.

---

## Overview

```
Raspberry Pi                          GCS Laptop
┌─────────────────────┐               ┌──────────────────────────────┐
│  /home/pi/captures/ │  HTTP (WiFi)  │  FastAPI Backend :8000       │
│  ├── img_001.jpg    │ ──────────►   │  POST /api/payload/push      │
│  ├── img_002.jpg    │               │  storage/payload/<session>/  │
│  └── img_003.jpg    │               └──────────────┬───────────────┘
└─────────────────────┘                              │ serves static files
          ▲                                          ▼
   Camera captures                       React Dashboard (Port 5173)
   images during flight           Payload / Images section — auto-refreshes
```

**Data channel:** RPi WiFi only. No USB cable, no SD card swap needed.

---

## Prerequisites

### On the GCS Laptop
- Backend running: `uvicorn main:app --reload --port 8000` (inside `UAV-backend/`)
- Dashboard running: `npm run dev` (inside `UAV-dashboard/`)
- GCS and RPi **on the same WiFi network**

### On the Raspberry Pi
- Python 3.7+
- `requests` library:
  ```bash
  pip install requests
  ```
- `rpi_image_push.py` copied onto the RPi (see Step 1 below)

---

## Step 1 — Copy the Script to the RPi

From your GCS laptop, transfer the script to the RPi over SSH:

```bash
scp m:\IROC\rpi_image_push.py pi@<RPI_IP>:/home/pi/
```

> **Finding your RPi IP:** On the RPi, run `hostname -I`. The first address shown is the IP.

You only need to do this once. The script lives on the RPi permanently.

---

## Step 2 — Find Your GCS Laptop's IP Address

The RPi will push images *to* your laptop. You need your laptop's IP on the local WiFi.

**On Windows (GCS laptop):**
```powershell
ipconfig
```
Look for the **Wi-Fi adapter → IPv4 Address** — it will look like `192.168.x.x`.

> **Example:** `192.168.0.105` → your GCS URL is `http://192.168.0.105:8000`

---

## Step 3 — Run the Push Script on the RPi

SSH into the RPi:
```bash
ssh pi@<RPI_IP>
```

### Option A — One-Shot (push all images once)

Pushes every image currently in the folder, then exits.

```bash
python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.105:8000
```

Expected output:
```
=======================================================
  RPi Image Push — UAV Dashboard Transfer
=======================================================
  Source : /home/pi/captures
  GCS    : http://192.168.0.105:8000
  Session: SESSION_20260401_190155
  Mode   : one-shot
=======================================================

  Found 5 image(s) to upload → Session: SESSION_20260401_190155
  GCS endpoint: http://192.168.0.105:8000/api/payload/push

  [  1/5] img_001.jpg (142.3 KB) … ✓
  [  2/5] img_002.jpg (137.8 KB) … ✓
  [  3/5] img_003.jpg (155.0 KB) … ✓
  [  4/5] img_004.jpg (148.5 KB) … ✓
  [  5/5] img_005.jpg (160.1 KB) … ✓

  ✅ Done — 5/5 uploaded successfully.
```

### Option B — Watch Mode (push images as camera captures them)

Stays running and detects new images as they are saved to the folder. Ideal for live missions.

```bash
python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.105:8000 --watch
```

To stop: press **Ctrl+C**.

### Options Reference

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--dir` | `-d` | Image folder path on the RPi | *(required)* |
| `--gcs` | `-g` | GCS backend URL | *(required)* |
| `--session` | `-s` | Custom session name | auto (timestamp) |
| `--watch` | `-w` | Watch mode (live) | one-shot |
| `--interval` | `-i` | Watch polling interval (seconds) | `3` |

### Custom session name example:
```bash
python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.105:8000 --session MISSION_DAY2_FLIGHT3
```

---

## Step 4 — View Images on the Dashboard

1. Open the dashboard in your browser: `http://localhost:5173`
2. Click **Payload / Images** in the left sidebar (camera icon)
3. Images appear automatically — grouped by session, **no manual refresh needed**
4. The gallery polls the backend every **5 seconds**

Each session shows:
- Session label (date + time)
- Image count badge
- Thumbnail grid — click any image to open fullscreen

---

## Supported Image Formats

`.jpg` · `.jpeg` · `.png` · `.bmp` · `.webp` · `.tiff`

---

## Managing Sessions on the Dashboard

Once images are displayed, you can:

- **Collapse/expand** a session by clicking the session header
- **Delete a session** by clicking the 🗑️ trash icon (removes all images for that session from the GCS — RPi originals are untouched)

---

## Troubleshooting

### ❌ `Cannot reach GCS at http://...`
- Confirm both devices are on **the same WiFi network**
- Verify the GCS IP with `ipconfig` — it may have changed if you reconnected
- Confirm the backend is running: open `http://<GCS_IP>:8000/docs` in a browser on the RPi

### ❌ `HTTP 400 — Only image files are accepted`
- The file you are trying to push is not an image, or its MIME type is unrecognised
- Make sure the folder only contains image files

### ❌ Images don't appear on dashboard
- Check the backend terminal — look for `Payload push: SESSION.../filename.jpg` log lines
- Make sure you're looking at the correct dashboard section: **Payload / Images** (camera icon in sidebar)
- Try clicking the refresh button (↻) at the top-right of the Payload section

### ❌ `pip install requests` fails (no internet on RPi)
Transfer the `requests` wheel manually:
```bash
# On a machine with internet
pip download requests -d ./requests_pkg

# Copy to RPi
scp -r ./requests_pkg pi@<RPI_IP>:/home/pi/

# Install offline on RPi
pip install --no-index --find-links=/home/pi/requests_pkg requests
```

---

## File Storage Location (on GCS)

Uploaded images are saved to:
```
UAV-backend/
└── storage/
    └── payload/
        └── SESSION_20260401_190155/
            ├── index.json        ← session metadata
            ├── img_001.jpg
            ├── img_002.jpg
            └── img_003.jpg
```

Served statically at: `http://localhost:8000/payload/<session_id>/<filename>`

---

## Quick Reference

```bash
# ── On RPi ─────────────────────────────────────────────────
# One-shot push
python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.105:8000

# Watch mode (live during flight)
python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.105:8000 --watch

# Custom session name
python rpi_image_push.py --dir /home/pi/captures --gcs http://192.168.0.105:8000 --session FLIGHT_001

# ── On GCS Laptop ──────────────────────────────────────────
# Find your IP
ipconfig

# Start backend
cd UAV-backend && uvicorn main:app --reload --port 8000

# Start dashboard
cd UAV-dashboard && npm run dev
```
