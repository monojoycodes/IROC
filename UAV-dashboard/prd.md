# 📄 Product Requirements Document (PRD)

## UAV Post-Flight Dashboard (React)

---

## 1. Purpose

Build a **web-based post-flight dashboard** that visualizes UAV mission data after landing.

The system must:

* Automatically display mission results once logs are downloaded
* Provide clear flight summary + health indicators
* Allow judges/operators to validate mission success
* Enable raw data export

The dashboard consumes **JSON + media files generated on the laptop backend**.
It never reads MAVLink directly.

---

## 2. Target Users

### Primary

* UAV operators (students / competition teams)

### Secondary

* Judges / reviewers
* Developers debugging flight behavior

---

## 3. Operating Assumptions

* UAV lands
* Laptop base station downloads `.BIN` log via MAVLink
* Backend parses log → generates JSON
* React UI loads that JSON

Flow:

```
Pixhawk → MAVLink → Laptop Backend → JSON → React UI
```

Raspberry Pi is only a packet bridge.

---

## 4. Non-Goals (Explicit)

The UI will NOT:

* Show live telemetry
* Send commands to UAV
* Arm/disarm vehicle
* Display RC channels
* Act as a flight controller

This avoids scope creep.

---

# 🧱 5. High-Level UI Structure

Single-page React app with routed sections:

```
/dashboard
  ├── Overview
  ├── Battery
  ├── Map
  ├── Flight Profile
  ├── System Health
  ├── Payload
  └── Downloads
```

Top navigation bar + left sidebar.

---

# ✅ 6. Required UI Sections (Core Features)

These are **mandatory**.

---

## 6.1 Mission Overview (Hero Section)

### Purpose

Instant mission validation.

### Display

Cards:

* Mission Status (Completed / Aborted)
* Flight Duration
* Total Distance
* Max Altitude
* Max Ground Speed
* Takeoff Time
* Landing Time

### Data Source (JSON)

```json
mission.duration
mission.distance
mission.max_altitude
mission.max_speed
mission.takeoff_time
mission.landing_time
mission.status
```

---

## 6.2 Battery Report

### Purpose

Power system evaluation.

### UI Elements

* Start %
* End %
* Minimum voltage
* Peak current
* Line chart: Voltage vs Time

### Charts

* X-axis: timestamp
* Y-axis: voltage

### Data

```json
battery.start_percent
battery.end_percent
battery.min_voltage
battery.peak_current
battery.voltage_curve[]
```

---

## 6.3 Flight Path Map

### Purpose

Visual proof of mission.

### UI

Embedded map (Leaflet / Mapbox):

* GPS polyline
* Takeoff marker (green)
* Landing marker (red)

Optional:

* Waypoints

### Data

```json
gps.track[]
gps.takeoff
gps.landing
```

Each track point:

```json
{ lat, lon, timestamp }
```

---

## 6.4 Flight Profile

### Purpose

Analyze climb / cruise / descent.

### Charts

* Altitude vs Time
* Ground Speed vs Time

Two stacked line graphs.

### Data

```json
profile.altitude[]
profile.speed[]
```

---

## 6.5 System Health

### Purpose

Safety + reliability verification.

This section separates amateurs from engineers.

### Display

Status cards:

* Failsafe Triggered: YES / NO
* GPS Quality (sat count + fix)
* EKF Status
* Arming Errors

Expandable log list:

* STATUSTEXT messages

### Data

```json
health.failsafe
health.gps_satellites
health.ekf_ok
health.arming_warnings[]
health.status_messages[]
```

---

## 6.6 Payload / Images (Optional)

Only if your Pi captures images.

### UI

Grid gallery:

* Thumbnail
* Timestamp
* GPS tag (optional)

Click → modal preview.

### Data

```json
payload.images[]
```

Each image:

```json
{ file, timestamp, lat, lon }
```

---

## 6.7 Downloads

### Purpose

Transparency + debugging.

Buttons:

* Download raw `.BIN`
* Download processed JSON

Links provided by backend.

---

# 📦 7. Backend Contract (What React Expects)

Single endpoint:

```
GET /api/mission/latest
```

Returns:

```json
{
  mission: {},
  battery: {},
  gps: {},
  profile: {},
  health: {},
  payload: {}
}
```

React loads once on page open.

No polling required.

---

# 🎨 8. UI/UX Requirements

### Style

* Dark theme preferred
* Card-based layout
* Large numeric KPIs
* Minimal clutter

### Behavior

* Loading spinner while JSON loads
* Error screen if mission missing
* Auto-refresh button

---

# ⚙️ 9. Tech Stack (Frontend)

* React (functional components)
* Chart.js / Recharts
* Leaflet / Mapbox
* Tailwind or MUI

No Redux required.

Simple local state.

---

# 📁 10. Suggested React Folder Structure

```
src/
 ├── pages/
 │    └── Dashboard.jsx
 ├── components/
 │    ├── MissionSummary.jsx
 │    ├── BatteryPanel.jsx
 │    ├── FlightMap.jsx
 │    ├── FlightProfile.jsx
 │    ├── SystemHealth.jsx
 │    ├── PayloadGallery.jsx
 │    └── Downloads.jsx
 └── services/
      └── api.js
```

---

# 🚫 11. Performance Constraints

* Dashboard load < 3s for typical flight
* Must handle ~50k GPS points
* Images lazy-loaded

---

# ✅ 12. Acceptance Criteria

The UI is considered complete when:

* A full mission can be viewed in under 3 clicks
* Battery + map + health are visible on first screen
* Raw log is downloadable
* No MAVLink dependency in frontend
* Works offline on localhost

---

# Final blunt summary

You are building:

> **A post-flight mission analyzer**

Not a controller.
Not a real-time monitor.

Your React app consumes JSON and files generated on the laptop after MAVLink log download.

That’s it.