# Technical Clarifications — UAV Backend

## 1. DISARM Signal & .BIN Download — How It Actually Works

### Current Implementation (MAVLink Live Listener)

`mavlink_client.py` opens a `mavutil.mavlink_connection()` and calls `recv_match(type='HEARTBEAT')` in a blocking loop. Each HEARTBEAT has `base_mode` — bit 7 (`0x80`) is `MAV_MODE_FLAG_SAFETY_ARMED`. When this bit transitions `1 → 0`, DISARM is detected and the callback fires.

`downloader.py` then sends `LOG_REQUEST_LIST` + `LOG_REQUEST_DATA` MAVLink messages to stream the binary data off the Pixhawk.

### Why This Doesn't Match Your Setup

Your architecture has an **onboard RPi** between the Pixhawk and the laptop:

```
Pixhawk ──serial (UART)──► RPi (onboard) ──WiFi/SCP──► Laptop (backend)
```

The backend on your laptop can't directly listen to MAVLink heartbeats from the Pixhawk — it's not plugged in. The realistic post-flight workflow is:

```
1. Flight ends → Pixhawk auto-saves .BIN to SD card
2. RPi (connected via UART) can also capture the log via MAVProxy/mavlogdump
3. After landing, you transfer the .BIN from RPi to laptop:
   - SCP:   scp pi@192.168.x.x:/home/pi/logs/latest.bin storage/logs/
   - rsync: rsync -avz pi@rpi:/logs/ storage/logs/
   - USB:   manually copy
4. Backend detects the new .BIN file (or you POST it via upload endpoint)
5. Backend parses it and generates the mission JSON
```

### Correct Approach for Post-Flight

Instead of a live MAVLink listener, the backend should support:

1. **File upload** — `POST /api/upload/log` to upload a .BIN file
2. **File watcher** — Optionally watch `storage/logs/` for new .BIN files
3. **Manual trigger** — `POST /api/simulate/trigger` (already implemented)

The `telemetry/mavlink_client.py` and `telemetry/downloader.py` files are for **future direct-connect mode** only.

---

## 2. MAVLink → JSON Pipeline — Technical Detail

The `.BIN` file is **NOT** raw MAVLink wire protocol. It's ArduPilot's **DataFlash** binary logging format. Key difference:

| Aspect | MAVLink Protocol | DataFlash .BIN |
|---|---|---|
| Purpose | Real-time communication | Post-flight logging |
| Encoding | MAVLink v1/v2 packets | Custom binary with FMT headers |
| Content | Heartbeats, commands, telemetry | High-frequency sensor data |
| Reader | `mavutil.mavlink_connection("udp:...")` | `mavutil.mavlink_connection("file.bin")` |

pymavlink handles both transparently — same API, different backend.

### The Conversion Chain

```
.BIN file (binary DataFlash)
    │
    ▼  pymavlink reads FMT headers to learn message formats
    │  Then iterates every message sequentially
    │
    ▼  parser.py: Collects into typed lists
    │  attitude=[], battery=[], altitude=[], speed=[], status_messages=[]
    │  Each entry: {timestamp: unix_float, ...field_values}
    │
    ▼  metrics.py: Computes derived analytics
    │  duration, max_altitude, max_speed, distance, battery_%
    │
    ▼  builder.py: Formats to frontend schema
    │  unix timestamps → ISO 8601 strings
    │  raw units → display-ready values
    │
    ▼  Saved as storage/missions/<id>.json
```

### How pymavlink Reads .BIN

```python
from pymavlink import mavutil

mlog = mavutil.mavlink_connection("flight.bin")

while True:
    msg = mlog.recv_match(blocking=False)
    if msg is None:
        break
    
    msg_type = msg.get_type()  # "ATT", "BAT", "BARO", etc.
    
    if msg_type == "ATT":
        print(msg.Roll, msg.Pitch, msg.Yaw)
    elif msg_type == "BAT":
        print(msg.Volt, msg.Curr)
```

The .BIN file **self-describes** its format — the first messages are always `FMT` entries that tell pymavlink "ATT has fields: TimeUS, DesRoll, Roll, DesPitch, Pitch, DesYaw, Yaw, ErrRP, ErrYaw". This means **any ArduPilot .BIN file works**, regardless of firmware version.

---

## 3. No GPS — VIO Navigation (GPS-Denied)

### What Changes

In GPS-denied mode, the .BIN file will **not** contain `GPS` messages. Instead, position comes from:

| Message | Source | Fields |
|---|---|---|
| `VISO` | Visual Inertial Odometry (T265/OpenCV on RPi) | `PosX, PosY, PosZ, AngDX, AngDY, AngDZ` |
| `XKF1` / `NKF1` | EKF position estimate (fuses VIO + IMU + BARO) | `PN (North), PE (East), PD (Down)` |
| `BARO` | Barometer (still present) | `Alt` |
| `ATT` | IMU attitude (still present) | `Roll, Pitch, Yaw` |

### Impact on Current Code

- **GPS track** — Instead of lat/lon, we'll have **local XY position** in meters from the takeoff point. The map component won't show a road map, but can show the flight path as a 2D plot.
- **Distance calculation** — Uses Euclidean distance on XY positions instead of haversine on lat/lon.
- **GPS health fields** — `gps_satellites`, `gps_fix` should show "N/A — VIO mode" instead of fake values.

The parser needs to extract `VISO` and `XKF1` messages, and the builder needs to handle the case where `gps.track` is empty.

---

## 4. Collecting Images from the RPi

The RPi stores captured images onboard during flight. After landing:

### Option A — Upload Endpoint (Recommended)

Add `POST /api/payload/upload` to accept image files:

```bash
# From RPi (or laptop after SCP):
curl -X POST http://laptop:8000/api/payload/upload \
  -F "files=@img_001.jpg" \
  -F "files=@img_002.jpg"
```

### Option B — SCP Script

```bash
# Pull images from RPi to backend storage
scp pi@192.168.x.x:/home/pi/captured_images/*.jpg \
    m:/IROC/UAV-backend/storage/payload/
```

### Option C — RPi Push Script

A script on the RPi that runs after landing:

```bash
#!/bin/bash
# On RPi: push images to laptop backend
rsync -avz /home/pi/images/ laptop_ip:/path/to/UAV-backend/storage/payload/
```

Once images are in `storage/payload/`, they're automatically served at `/payload/<filename>` by the FastAPI static file mount. The mission JSON references them as:

```json
"payload": {
  "images": [
    {"file": "/payload/img_001.jpg", "timestamp": "...", "lat": null, "lon": null}
  ]
}
```

---

## 5. .BIN File Parameters — Complete List with Proof

### Source: [ArduPilot Official Documentation](https://ardupilot.org/copter/docs/logmessages.html)

Every .BIN file self-describes via `FMT` messages at the start. The standard Copter messages:

### Core Flight Data

| Message | Description | Key Fields | Proof |
|---|---|---|---|
| **ATT** | Attitude | `TimeUS, DesRoll, Roll, DesPitch, Pitch, DesYaw, Yaw, ErrRP, ErrYaw` | [ArduPilot Wiki](https://ardupilot.org/copter/docs/logmessages.html#att) |
| **CTUN** | Control/Throttle/Alt | `TimeUS, ThrIn, Alt, BarAlt, DAlt, ThO, SAlt` | [ArduPilot Wiki](https://ardupilot.org/copter/docs/logmessages.html#ctun) |
| **BARO** | Barometer | `TimeUS, Alt, Press, Temp, CRt` | [ArduPilot Wiki](https://ardupilot.org/copter/docs/logmessages.html#baro) |

### Power

| Message | Description | Key Fields |
|---|---|---|
| **BAT** | Battery monitor | `TimeUS, Volt, Curr, CurrTot, EnrgTot, Temp, Res` |
| **POWR** | Board power | `TimeUS, Vcc, VServo, Flags` |

### Navigation (GPS-denied will use VISO/XKF instead)

| Message | Description | Key Fields |
|---|---|---|
| **GPS** | GPS receiver | `TimeUS, Status, GMS, GWk, NSats, Lat, Lng, Alt, Spd, GCrs, VZ` |
| **VISO** | Visual odometry | `TimeUS, dt, AngDX, AngDY, AngDZ, PosX, PosY, PosZ, Qual` |
| **XKF1** | EKF state | `TimeUS, Roll, Pitch, Yaw, VN, VE, VD, PN, PE, PD` |
| **NKF1** | EKF (instance 2) | Same as XKF1 |

### System

| Message | Description | Key Fields |
|---|---|---|
| **MSG** / **STATUSTEXT** | Status messages | `TimeUS, Message` / `Severity, Text` |
| **MODE** | Flight mode changes | `TimeUS, Mode, ModeNum, Rsn` |
| **ERR** | Error codes | `TimeUS, Subsys, ECode` |
| **EV** | Events (arm/disarm) | `TimeUS, Id` |
| **ARM** | Arming info | `TimeUS, ArmState, Method` |
| **CMD** | Commands executed | `TimeUS, CTot, CNum, CId, Prm1-4` |
| **RCIN** | RC input channels | `TimeUS, C1-C14` |
| **RCOU** | Servo/motor outputs | `TimeUS, C1-C14` |

### IMU

| Message | Description | Key Fields |
|---|---|---|
| **IMU** | Accelerometer + Gyro | `TimeUS, GyrX, GyrY, GyrZ, AccX, AccY, AccZ, Temp` |
| **VIBE** | Vibration levels | `TimeUS, VibeX, VibeY, VibeZ, Clip0, Clip1, Clip2` |

### What Your .BIN Will Have

Controlled by `LOG_BITMASK` parameter on the Pixhawk. Default for Copter logs almost everything. You can check what YOUR .BIN has by running:

```python
from pymavlink import mavutil
mlog = mavutil.mavlink_connection("your_flight.bin")
types = set()
while True:
    msg = mlog.recv_match(blocking=False)
    if msg is None: break
    types.add(msg.get_type())
print(sorted(types))
```

---

## 6. No Live Telemetry — Post-Flight Only

### What This Means for the Architecture

The current code has two things that assume live connection:

1. `mavlink_client.py` — Runs a persistent connection listening for heartbeats
2. `downloader.py` — Sends LOG_REQUEST commands over a live MAVLink link

**For post-flight only, neither is needed during normal operation.** The workflow becomes:

```
User lands drone
    ↓
User transfers .BIN file to laptop (SCP/USB/upload endpoint)
    ↓
Backend detects new file (or user triggers processing)
    ↓
parser.py → metrics.py → builder.py → JSON saved
    ↓
Dashboard loads the processed data
```

### What Should Be Updated

1. Add `POST /api/upload/log` — Upload a .BIN file and trigger parsing
2. The simulation endpoints already handle the "trigger processing" flow
3. `mavlink_client.py` and `downloader.py` remain available for **future direct-connect mode** but are not used in the default post-flight workflow

---

## Summary of Required Code Changes

| Issue | Current State | Needed Fix |
|---|---|---|
| GPS assumption | GPS track generated in simulation | Support VISO/XKF1 for position, allow empty GPS |
| Image collection | No upload mechanism | Add `POST /api/payload/upload` endpoint |
| Post-flight BIN upload | Only live download or simulation | Add `POST /api/upload/log` endpoint |
| Live telemetry assumption | MAVLink client starts on boot | Only start if `MAVLINK_CONNECTION` is set (already done) |
