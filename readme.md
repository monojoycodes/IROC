# IROC — UAV Ground Station

React dashboard + FastAPI backend for UAV post-flight analysis.

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10

## Backend

```bash
cd UAV-backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Runs on `http://localhost:8000` — API docs at `/docs`.

> Set `MAVLINK_CONNECTION` env var (e.g. `udp:127.0.0.1:14550`) for live mode. Without it, runs in simulation.

## Frontend

```bash
cd UAV-dashboard
npm install
npm run dev
```

Runs on `http://localhost:5173`.

## Reset Server State

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:8000/simulate/reset
```

Resets the backend state back to idle — useful for re-testing dashboard transitions.

# How to Run: Pixhawk → Backend → Dashboard

## Physical Connections

You have **two options** to connect your Pixhawk to your laptop:

### Option A: USB Direct (Simplest)

```
Pixhawk ──USB Cable──► Laptop
```

- Plug a micro-USB / USB-C cable from the Pixhawk's USB port to your laptop
- This works for post-flight log download (drone must be on the ground, powered)

### Option B: Telemetry Radio (Remote)

```
Pixhawk ──TELEM1/2──► 📡 Air Radio ~~wireless~~► 📡 Ground Radio ──USB──► Laptop
```

- Pair your telemetry radios (e.g., SiK 433/915 MHz)
- Air radio connects to Pixhawk's `TELEM1` or `TELEM2` port
- Ground radio plugs into your laptop via USB
- Range: typically 500m–1km+ depending on radio

> [!NOTE]
> **No, you do NOT need to open ArduPilot, Mission Planner, QGroundControl, or any GCS software.** Your backend connects directly to the Pixhawk via `pymavlink`. Running a GCS at the same time would actually **conflict** since two programs can't share the same COM port.

---

## Step-by-Step Instructions

### Step 1: Find Your COM Port

1. Connect your Pixhawk (USB or telemetry radio) to the laptop
2. Open **Device Manager** → expand **Ports (COM & LPT)**
3. Look for something like `USB Serial Device (COM3)` or `Silicon Labs CP210x (COM5)`
4. Note the **COM number** (e.g., `COM3`)

### Step 2: Install Backend Dependencies

```powershell
cd m:\IROC\UAV-backend
pip install -r requirements.txt
```

> [!IMPORTANT]
> This installs `pymavlink` which is required for MAVLink communication. If `pymavlink` install fails, you may need: `pip install pymavlink --no-cache-dir`

### Step 3: Start the Backend

```powershell
cd m:\IROC\UAV-backend

# Set your COM port (replace COM3 with your actual port)
$env:MAVLINK_CONNECTION = "com3"

# Start the server
uvicorn main:app --reload --port 8000
```

You should see:

```
═══════════════════════════════════════════════════
  UAV Post-Flight Backend Starting
═══════════════════════════════════════════════════
🔌 LIVE MODE — MAVLink: com3
  Connecting to com3…
  Waiting for heartbeat…
  Heartbeat received (system 1, component 1)
✅ Background worker started
  Backend ready. Serving API on /api
```

### Step 4: Start the Dashboard

Open a **new terminal**:

```powershell
cd m:\IROC\UAV-dashboard
npm run dev
```

Open the dashboard URL shown (typically `http://localhost:5173`).

### Step 5: Fly and Land

1. The dashboard will show **"Waiting for flight…"** state
2. Fly your mission normally
3. When the drone **lands and disarms**, the backend auto-detects it
4. You'll see the pipeline run in the backend terminal:

```
🔴 DISARM detected — triggering mission processing
State → DOWNLOADING
  Downloading log #42 (1847.3 KB)…
State → PARSING
  Parsing flight data…
State → READY (mission: FLT_20260311_173000)
```

5. The dashboard **auto-refreshes** and displays all flight data

---

## Without Hardware (Simulation Mode)

If you want to test without a Pixhawk connected:

```powershell
cd m:\IROC\UAV-backend

# Don't set MAVLINK_CONNECTION — backend auto-detects simulation mode
uvicorn main:app --reload --port 8000
```

The backend generates sample mission data automatically. You can also trigger new simulated flights:

```powershell
curl -X POST http://localhost:8000/api/simulate/trigger
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "No heartbeat received" | Check COM port number, ensure Pixhawk is powered on |
| COM port busy / access denied | Close Mission Planner or any other GCS software |
| `pymavlink` import error | Run `pip install pymavlink` |
| Dashboard shows "Backend Unreachable" | Ensure backend is running on port 8000 |
| "No logs found on flight controller" | Pixhawk SD card may be missing or full |
