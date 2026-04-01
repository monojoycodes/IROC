# IROC UAV Dashboard & Telemetry Server — Setup Guide

This guide walks you through setting up both the Python FastAPI backend and the React Vite frontend, as well as configuring the Pixhawk for live telemetry and the Raspberry Pi for aerial payload image uploads.

---

## 1. Prerequisites

Ensure you have the following installed on the Ground Control Station (GCS) laptop:
*   **Python 3.10+** (for the backend)
*   **Node.js & npm** (v18+, for the frontend)
*   **Git**

---

## 2. Backend Setup (`UAV-backend`)

The backend polls the Pixhawk over a telemetry radio in real-time and acts as the data hub.

### Installation
1. Open a terminal and navigate to the backend directory:
   ```powershell
   cd m:\IROC\UAV-backend
   ```
2. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install the required Python packages:
   ```powershell
   pip install -r requirements.txt
   ```

### Configuration (Environment Variables)
The backend needs to know how to talk to your Pixhawk. You can set this temporarily in powershell before running, or put it in a `.env` file in the root of `UAV-backend`.

```powershell
# If using a USB/Telemetry radio on COM10
$env:MAVLINK_CONNECTION="com10"

# If using a UDP simulator (SITL)
$env:MAVLINK_CONNECTION="udp:127.0.0.1:14550"
```

### Running the Backend
```powershell
uvicorn main:app --reload --port 8000
```
*The backend must be running on port 8000 for the frontend to find it by default.*

---

## 3. Frontend Setup (`UAV-dashboard`)

The frontend is a dual-mode React application that automatically switches between an In-Flight UI and a Post-Flight Analysis UI.

### Installation
1. Open a **new** terminal (keep the backend running) and navigate to the dashboard directory:
   ```powershell
   cd m:\IROC\UAV-dashboard
   ```
2. Install npm dependencies:
   ```powershell
   npm install
   ```

### Configuration
By default, the Vite app looks for the backend at `http://localhost:8000`. If you run the backend on a different port or machine, create a `.env` file inside `UAV-dashboard`:
```env
VITE_API_BASE=http://localhost:8000
```

### Running the Frontend
```powershell
npm run dev
```
*Open the provided local URL (usually `http://localhost:5173`) in your web browser.*

---

## 4. Hardware Configuration

### Pixhawk Telemetry Rates (Mission Planner)
For the live 3D Gyroscope and flight metrics to update smoothly, the Pixhawk must emit telemetry fast enough. 

Connect to your drone in **Mission Planner** > **Config/Tuning** > **Full Parameter List**, and verify or update these Stream Rate (SR0) parameters (assuming you use Telemetry 1 / Serial 1):

| Parameter | Recommended Value | What it enables |
| :--- | :--- | :--- |
| `SR0_EXTRA1` | `10` | High-frequency `ATTITUDE` (Roll, Pitch, Yaw) |
| `SR0_EXTRA2` | `10` | High-frequency `VFR_HUD` (Altitude, Speed, Heading) |
| `SR0_EXT_STAT` | `2`  | Standard-frequency `SYS_STATUS` (Battery Voltage, Current, %) |

---

## 5. Raspberry Pi Automatic Image Uploader

During flight, the RPi captures target images. We use an automated Python daemon (`rpi_auto_uploader.py`) to automatically detect when the drone has landed and connected to the GCS WiFi, and instantly upload the images.

### 5.1 Network Setup
1. Ensure the GCS Laptop is acting as a hotspot (or both are on the same router).
2. Note the GCS Laptop's IPv4 address (e.g., `192.168.1.100`).

### 5.2 Deploy the Script to RPi
1. Copy the `rpi_auto_uploader.py` file from your GCS to the Raspberry Pi (e.g., into `/home/pi/`).
2. Open the file on the RPi and ensure the configuration matches your setup:

```python
# Change this to your laptop's actual IP address
GCS_BACKEND_URL = "http://192.168.1.100:8000"

# Where your ML script saves the detections
DETECTIONS_DIR = "/home/pi/ai-vision/detections"
IMAGES_DIR = "/home/pi/ai-vision/images"
```

3. Make the script executable:
```bash
chmod +x /home/pi/rpi_auto_uploader.py
```

### 5.3 Run as a Background Service (systemd)
To make the script start automatically every time the RPi boots up, create a systemd service.

1. Create a new service file:
```bash
sudo nano /etc/systemd/system/rpi-uploader.service
```

2. Add the following configuration (assuming the script is in `/home/pi/`):
```ini
[Unit]
Description=RPi Auto-Uploader for UAV Dashboard
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/rpi_auto_uploader.py
WorkingDirectory=/home/pi
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rpi-uploader
User=pi
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rpi-uploader.service
sudo systemctl start rpi-uploader.service
```

### How it works on flight day:
You don't need to manually SSH into the Pi anymore!
1. The drone lands.
2. The RPi automatically joins the GCS WiFi.
3. The background service detects `http://192.168.1.100:8000/api/health`.
4. It instantly uploads all images and logs, then moves them to an `archive` folder.
5. They appear instantly on your dashboard's Detection Gallery.
