# WTH is going on? — UAV Backend Explained for Beginners

## The Big Picture

You have a **drone** (UAV) with a **Pixhawk** flight controller. After the drone lands, you want to see what happened during the flight — altitude, speed, battery, GPS path, etc. — on a nice **web dashboard**.

This backend is the **middleman** between the drone and the dashboard:

```
Drone (Pixhawk)  →  Backend (this code)  →  Dashboard (React website)
```

The drone speaks a protocol called **MAVLink**. The dashboard speaks **HTTP/JSON**. The backend translates between the two.

---

## How It Works (The Pipeline)

Think of it like a factory assembly line:

```
1. Drone lands (DISARM detected)
        ↓
2. Backend downloads the .BIN flight log from the drone
        ↓
3. Backend parses the raw binary data into readable numbers
        ↓
4. Backend computes stats (max altitude, distance, battery %)
        ↓
5. Backend saves a JSON file with all the data
        ↓
6. Dashboard asks for the JSON and displays it
```

While this is happening, the backend tracks its **state**:

| State | What's happening |
|---|---|
| `idle` | Waiting. No flight happening. |
| `downloading` | Pulling the .BIN log from the drone |
| `parsing` | Reading through the log file |
| `ready` | Done! Data available for the dashboard |
| `error` | Something broke |

The dashboard polls this state every 2 seconds and shows appropriate UI (spinner, progress bar, or the full dashboard).

---

## Folder Structure

```
UAV-backend/
│
├── main.py                  ← THE entry point. Start here.
├── requirements.txt         ← Python packages needed
├── state.py                 ← (unused, kept for compatibility)
│
├── core/
│   └── state_manager.py     ← The "brain" — tracks what state we're in
│
├── api/
│   └── routes.py            ← All the URLs the dashboard calls
│
├── processing/
│   ├── parser.py            ← Reads .BIN drone log files
│   ├── metrics.py           ← Calculates flight stats
│   └── builder.py           ← Builds the final JSON for the dashboard
│
├── telemetry/
│   ├── mavlink_client.py    ← Listens for drone heartbeats
│   └── downloader.py        ← Downloads logs from the drone
│
├── workers/
│   └── mission_worker.py    ← Runs the pipeline in the background
│
├── models/
│   └── mission.py           ← Data shapes (Pydantic schemas)
│
└── storage/                 ← Where data lives on disk
    ├── logs/                ← Raw .BIN files from the drone
    ├── missions/            ← Processed JSON files
    └── payload/             ← Images captured during flight
```

---

## File-by-File Explanation

### `main.py` — The Starting Point

**What it does:** Sets up the web server and starts everything.

**In plain English:** When you run `python -m uvicorn main:app`, this file:
1. Creates the FastAPI web server
2. Creates the `storage/` folders if they don't exist
3. Starts a background worker that listens for drone events
4. Tells the server "here are the URLs the dashboard can call"

**Key things:**
- `CORS middleware` — Lets the dashboard (running on a different port) talk to us
- `lifespan` — Code that runs when the server starts and stops
- `StaticFiles("/payload")` — Serves drone camera images as regular URLs

```python
# This is the "on startup" code
@asynccontextmanager
async def lifespan(app):
    # Create folders
    _ensure_storage()
    # Start the background worker
    worker_task = asyncio.create_task(start_mission_worker(connection))
    yield  # Server runs here
    # Cleanup when stopping
    worker_task.cancel()
```

---

### `core/state_manager.py` — The Brain

**What it does:** Tracks the current state of the pipeline.

**In plain English:** This is a shared variable that both the background worker and the web server can access. The worker writes to it ("I'm downloading now"), and the API reads from it ("the state is downloading").

**Why "thread-safe"?** The worker and web server run at the same time. If they both try to read/write the state simultaneously, data could get corrupted. The `threading.Lock()` prevents that — it's like a "one at a time please" sign on a door.

```python
# Worker does this:
state_manager.set_downloading("Getting log from drone…")
state_manager.update_progress(0.5, "50% done")
state_manager.set_ready(mission_id="FLT_001", ...)

# API does this:
state_manager.get_state()  
# Returns: {"state": "downloading", "progress": 0.5, "message": "50% done"}
```

---

### `api/routes.py` — The URLs

**What it does:** Defines every URL the dashboard can call.

**In plain English:** The dashboard makes HTTP requests. This file says "when someone asks for `/api/health`, give them this data." It's like a menu at a restaurant — here's what we serve.

**All endpoints:**

| URL | What the dashboard gets |
|---|---|
| `GET /api/health` | Is the backend alive? How long has it been running? |
| `GET /api/mission/state` | What's the pipeline doing right now? (idle/downloading/parsing/ready) |
| `GET /api/mission/latest` | Give me the latest flight data JSON |
| `GET /api/mission/list` | List all past flights (for the dropdown selector) |
| `GET /api/mission/{id}` | Give me a specific past flight's data |
| `GET /api/downloads/meta` | How big are the downloadable files? |
| `GET /api/downloads/raw-log` | Download the raw .BIN file |
| `GET /api/downloads/processed-json` | Download the processed JSON |
| `POST /api/simulate/trigger` | **Fake a drone landing** (for testing!) |
| `POST /api/simulate/reset` | Reset state to "idle" |

**Important rule:** These endpoints **never compute anything**. They only read files from disk or read the current state. All computation happens in the worker.

---

### `processing/parser.py` — Reading Drone Logs

**What it does:** Opens a `.BIN` file and extracts all the flight data from it.

**In plain English:** A `.BIN` file is a binary log that the Pixhawk writes during flight. It contains thousands of **messages** — each one is a snapshot of something: the drone's angle, battery voltage, GPS position, etc.

This file reads through every message and sorts them into categories:

| Message Type | What it contains | Example |
|---|---|---|
| `ATT` | Attitude (roll, pitch, yaw) | "Drone is tilted 5° right" |
| `BAT` | Battery stats | "Voltage: 15.2V, Current: 12A" |
| `BARO` | Barometer altitude | "Height: 45 meters" |
| `CTUN` | Control tuning (alt + speed) | "Speed: 12 m/s" |
| `GPS` | GPS coordinates | "Lat: 28.6139, Lon: 77.2090" |
| `STATUSTEXT` | System messages | "Reached waypoint #1" |
| `HEARTBEAT` | Armed/disarmed state | "Drone is armed" |

```python
# It returns a dict like this:
{
    "altitude": [{"timestamp": 123, "altitude": 45.2}, ...],
    "battery": [{"timestamp": 123, "voltage": 15.2}, ...],
    "gps": [{"timestamp": 123, "lat": 28.61, "lon": 77.20}, ...],
    ...
}
```

---

### `processing/metrics.py` — Crunching Numbers

**What it does:** Takes the raw parsed data and computes summary stats.

**In plain English:** The parser gives you thousands of data points. The metrics engine boils them down:

- **Duration** — How long was the flight? (from ARM to DISARM timestamps)
- **Max altitude** — Highest point reached
- **Max speed** — Fastest the drone flew
- **Distance** — Total ground distance covered (using GPS, calculated with the *haversine formula* for Earth's curvature)
- **Battery** — Start %, end %, lowest voltage, highest current draw
- **Status** — Did anything go wrong? ("completed" vs "warning")

```python
# Haversine = math formula to calculate distance between 
# two lat/lon points on a sphere (Earth)
def _haversine(lat1, lon1, lat2, lon2):
    # ... returns distance in meters
```

---

### `processing/builder.py` — Building the Dashboard JSON

**What it does:** Takes parsed data + metrics and assembles the final JSON that the dashboard expects.

**In plain English:** The dashboard has a very specific data format it needs. For example, it expects timestamps as ISO strings like `"2026-03-01T08:05:43+00:00"`, not Unix numbers like `1709280343`. This file converts everything into the exact shape the dashboard wants.

The JSON structure looks like:
```json
{
  "mission": { "status", "duration", "max_altitude", ... },
  "battery": { "start_percent", "voltage_curve", ... },
  "gps": { "track": [{"lat", "lon", "timestamp"}, ...] },
  "profile": { "altitude": [...], "speed": [...] },
  "health": { "failsafe", "status_messages", ... },
  "payload": { "images": [...] }
}
```

---

### `telemetry/mavlink_client.py` — Listening for the Drone

**What it does:** Connects to the Pixhawk and watches for the drone to land.

**In plain English:** The Pixhawk sends a "heartbeat" message every second, like a pulse. Each heartbeat says whether the drone is **armed** (motors active) or **disarmed** (motors off). 

This file watches those heartbeats. When it detects an **armed → disarmed** transition, that means the drone just landed, so it fires a callback to start processing.

```
Heartbeat: armed ✅
Heartbeat: armed ✅
Heartbeat: armed ✅
Heartbeat: DISARMED ❌  ← "Hey! Drone landed! Start processing!"
```

---

### `telemetry/downloader.py` — Getting the Log File

**What it does:** Downloads the actual `.BIN` log file from the Pixhawk.

**In plain English:** After landing, we need to get the flight log off the drone. This file sends MAVLink commands saying "give me your log list" and "send me log #X", then receives the binary data chunk by chunk and saves it to `storage/logs/`.

It reports progress (0% → 100%) which the dashboard shows as a progress bar.

---

### `workers/mission_worker.py` — The Orchestrator

**What it does:** Runs the entire pipeline in the background.

**In plain English:** This is the conductor of the orchestra. It coordinates everything:

1. Wait for DISARM event (or simulation trigger)
2. Update state → `downloading`
3. Call the downloader
4. Update state → `parsing`
5. Call the parser → metrics → builder
6. Save the JSON
7. Update state → `ready`
8. If anything fails → update state → `error`

**Two modes:**
- **LIVE mode** — Actually connects to a Pixhawk via MAVLink. Used in the field.
- **SIMULATION mode** — Generates fake data. Used for development (which is what you're using now).

---

### `models/mission.py` — Data Shapes

**What it does:** Defines Pydantic models for API responses.

**In plain English:** These are like blueprints that say "this API response must have these fields with these types." If the code accidentally tries to return wrong data, Pydantic catches the error.

---

### `storage/` — The Database

There's no actual database. Just files on disk:

```
storage/
├── logs/          ← Raw .BIN files straight from the drone
├── missions/      ← Processed .JSON files (what the dashboard reads)  
└── payload/       ← Camera images from the drone
```

The API reads these files directly. That's it.

---

## How the Dashboard Connects

The dashboard (React/Vite) runs on `localhost:5173`. The backend (FastAPI) runs on `localhost:8000`. The Vite config has a **proxy** so that when the dashboard calls `/api/health`, Vite forwards it to `http://localhost:8000/api/health`:

```js
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:8000',
    '/payload': 'http://localhost:8000',
  }
}
```

---

## How to Simulate Without a Drone

Since you don't have a Pixhawk plugged in:

```powershell
# 1. Reset to "waiting for flight" state
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/simulate/reset

# 2. Simulate a drone landing (triggers full pipeline)
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/simulate/trigger

# 3. Watch the dashboard go through:
#    "Waiting for Mission" → "Downloading..." → "Parsing..." → Full dashboard!
```

Each trigger creates a new mission with **randomized** data — different duration, altitude, speed, GPS path, battery stats.

---

## The One-Sentence Summary

> The backend listens for the drone to land, downloads its flight log, crunches the numbers, saves a JSON file, and serves it to the dashboard over HTTP.

That's it. That's the whole thing.
