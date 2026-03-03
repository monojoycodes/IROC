# UAV Post-Flight Dashboard — Technical Report (v2)

**Generated:** 25-02-2026  
**PRD Version:** v2 (UI Hardened for Backend Integration)  
**Build Status:** ✅ Production build passes — 0 errors, 2437 modules, 15s build

---

## 1. Executive Summary

This React SPA is a **post-flight dashboard** for UAV mission data. It visualizes data from a backend that parses Pixhawk `.BIN` logs via MAVLink.

**PRD v1** delivered the UI shell with 7 sections.  
**PRD v2** hardened it into a **backend-ready flight engineering console**:

- No silent mock fallback in production
- Mission lifecycle state awareness (idle → downloading → parsing → ready → error)
- Backend health monitoring
- Mission selector for past flights
- Sortable log timeline
- Performance guardrails for 50k+ GPS points
- Explicit units on all values
- Download file sizes from backend

**After PRD v2: Frontend is frozen. Backend only.**

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  StatusBar (fixed, full-width, z-200)                    │
│  STATUS: DOCKED · timestamp · BATTERY %                  │
├──────────┬───────────────────────────────────────────────┤
│          │  Navbar (fixed)                                │
│          │  Title · Status Badge · MissionSelector        │
│          │  BackendHealth · Refresh                       │
│ Sidebar  ├───────────────────────────────────────────────┤
│ (fixed)  │  Main Content (scrollable)                    │
│          │   ├── MissionStateOverlay (blocks if !ready)  │
│          │   ├── Mission Overview (7 KPI cards)          │
│          │   ├── Battery Report (memoized chart)         │
│          │   ├── Flight Map (downsampled GPS)            │
│          │   ├── Flight Profile (2 memoized charts)      │
│          │   ├── System Health + LogTimeline (sortable)  │
│          │   ├── Payload Gallery (lazy loading)          │
│          │   └── Downloads (with file sizes)             │
└──────────┴───────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 + Vite 7 | SPA core |
| Routing | react-router-dom | `/` and `/dashboard` |
| Charts | Recharts | Voltage, altitude, speed graphs |
| Map | react-leaflet + Leaflet | GPS flight path |
| Icons | lucide-react | UI icons throughout |
| Styling | Vanilla CSS (custom properties) | Dark theme design system |
| Fonts | Inter (Google Fonts) | Typography |
| Map Tiles | OpenStreetMap | Free, no API key |

---

## 3. File Structure (Post PRD v2)

```
src/
├── components/
│   ├── StatusBar.jsx            ← Top strip: STATUS + timestamp + battery
│   ├── Sidebar.jsx              ← Left nav with section links
│   ├── Navbar.jsx               ← Title + status + mission selector + BackendHealth + refresh
│   ├── BackendHealth.jsx        ← [NEW] Backend connectivity indicator in navbar
│   ├── MissionStateOverlay.jsx  ← [NEW] Full-screen overlay blocking dashboard until state=ready
│   ├── MissionSummary.jsx       ← 7 KPI cards with explicit units
│   ├── BatteryPanel.jsx         ← 4 stats + memoized voltage chart (V on Y-axis)
│   ├── FlightMap.jsx            ← Leaflet map with GPS downsampling (max 5k points)
│   ├── FlightProfile.jsx       ← Memoized altitude (m) + speed (m/s) charts
│   ├── SystemHealth.jsx         ← Health cards + expandable logs + LogTimeline
│   ├── LogTimeline.jsx          ← [NEW] Sortable timestamp|severity|message log view
│   ├── PayloadGallery.jsx       ← Lazy-loaded image grid + modal preview
│   └── Downloads.jsx            ← Download cards with file sizes from backend
├── data/
│   └── mockMission.js           ← Dev-only auto-generated sample dataset
├── pages/
│   └── Dashboard.jsx            ← Page orchestrator: state polling, mission selector, data fetch
├── services/
│   ├── api.js                   ← Mission data fetch (throws in prod, mock in dev)
│   ├── health.js                ← [NEW] GET /api/health polling
│   └── missions.js              ← [NEW] Mission state, list, download metadata
├── App.jsx                      ← Router
├── App.css                      ← Layout (sidebar + navbar + main + statusbar offsets)
├── index.css                    ← Full design system + PRD v2 overlay/timeline/health CSS
└── main.jsx                     ← Entry point
```

---

## 4. PRD v2 Changes Implemented

### ✅ 1. Mission State Controller (`MissionStateOverlay.jsx`)

Full-screen overlay that **blocks the dashboard** until mission state = `ready`.

| Backend State | UI Behavior |
|--------------|-------------|
| `idle` | Plane icon + "Waiting for Mission…" |
| `downloading` | Spinner + progress bar + percentage |
| `parsing` | Spinner + "Parsing Flight Data…" |
| `ready` | Overlay disappears, dashboard loads |
| `error` | Red alert + error message + Retry button |

**Polling:** Dashboard polls `GET /api/mission/state` every 2 seconds when in `downloading` or `parsing` state, and auto-loads data when state transitions to `ready`.

---

### ✅ 2. No Silent Mock Fallback in Production (`api.js`)

```diff
- catch { return mockMission; }
+ catch (err) {
+   if (import.meta.env.PROD) throw new Error(`Backend unreachable: ${err.message}`);
+   return mockMission;  // dev only
+ }
```

**Dev mode:** Falls back to mock data with console warning.  
**Production:** Throws error → shows red error screen with Retry button.

---

### ✅ 3. Backend Health Panel (`BackendHealth.jsx`)

Sits inside the Navbar. Polls `GET /api/health` every 15 seconds.

Shows:
- Green/red Wifi icon for connectivity
- Green/red dot
- Last mission timestamp
- Log file size (MB)
- Parse duration (ms)

---

### ✅ 4. Mission Selector (`Navbar.jsx`)

A `<select>` dropdown in the Navbar populated from `GET /api/mission/list`.

- Selecting a mission calls `GET /api/mission/:id` and re-renders the dashboard
- Hidden when no missions available (graceful degradation)

---

### ✅ 5. Log Timeline View (`LogTimeline.jsx`)

Added below the expandable log list in SystemHealth.

- Three-column grid: `timestamp | severity | message`
- Scrollable (max-height 320px)
- Sort toggle: chronological ↔ severity order
- Monospace font for readability
- Maps directly to ArduPilot `STATUSTEXT`

---

### ✅ 6. Performance Guardrails

**FlightMap.jsx — GPS Downsampling:**
- `downsample()` function reduces arrays to max 5000 points
- Always preserves first and last point
- Shows "Showing 5,000 of 50,000 GPS points" when active
- All positions are `useMemo`-ized

**BatteryPanel.jsx — Chart Memoization:**
- `chartData` wrapped in `useMemo(() => ..., [data.voltage_curve])`

**FlightProfile.jsx — Chart Memoization:**
- Both `altData` and `speedData` wrapped in `useMemo`

---

### ✅ 7. Payload Lazy Loading (`PayloadGallery.jsx`)

Already had `loading="lazy"` on `<img>` tags. Added CSS transitions:
- Images start at `opacity: 0.3`
- Transition to full opacity when loaded

---

### ✅ 8. Explicit Units Everywhere

| Section | Value | Unit |
|---------|-------|------|
| Mission Summary | Distance | km |
| Mission Summary | Max Altitude | m |
| Mission Summary | Max Speed | m/s |
| Battery Panel | Start/End Charge | % |
| Battery Panel | Min Voltage | V |
| Battery Panel | Peak Current | A |
| Battery Chart | Y-axis | V |
| Altitude Chart | Y-axis | m |
| Speed Chart | Y-axis | m/s |
| GPS Quality | Satellites | sats |

---

### ✅ 9. Downloads Panel Upgrade (`Downloads.jsx`)

Fetches file size metadata from `GET /api/downloads/meta` on mount.

Displays:
```
Download RAW (38.2 MB)
Download JSON (1.4 MB)
```

Falls back gracefully if metadata endpoint is unavailable (no size shown).

---

### ✅ 10. Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| No mock fallback in prod | ✅ |
| Mission state overlay works | ✅ |
| Backend health visible | ✅ |
| Timeline logs scroll | ✅ |
| Map handles 50k points | ✅ (downsample to 5k) |
| Charts memoized | ✅ |
| Payload lazy loads | ✅ |
| Units everywhere | ✅ |
| Download sizes shown | ✅ |

---

## 5. Complete API Contract

Your backend must implement these endpoints. **The frontend is already wired to consume them.**

---

### `GET /api/mission/state`

**Purpose:** Report mission pipeline lifecycle state.

```json
{
  "state": "idle | downloading | parsing | ready | error",
  "progress": 0.65,
  "message": "Downloading log from Pixhawk…"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `state` | string | ✅ | One of: `idle`, `downloading`, `parsing`, `ready`, `error` |
| `progress` | number | ❌ | 0.0–1.0, only used during `downloading` |
| `message` | string | ❌ | Overrides default UI subtitle |

**Frontend behavior:** Polled every 2 seconds until `ready` or `error`.

---

### `GET /api/health`

**Purpose:** Backend connectivity + diagnostics.

```json
{
  "backend": "ok",
  "last_mission": "2026-02-25T10:40:00.000Z",
  "log_size_mb": 42.1,
  "parse_time_ms": 830
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `backend` | string | ✅ | Always `"ok"` if responding |
| `last_mission` | string | ❌ | ISO 8601 timestamp |
| `log_size_mb` | number | ❌ | .BIN file size in MB |
| `parse_time_ms` | number | ❌ | Time to parse log in milliseconds |

**Frontend behavior:** Polled every 15 seconds.

---

### `GET /api/mission/latest`

**Purpose:** Return the most recent mission's full dataset.

```json
{
  "mission": {
    "status": "Completed",
    "duration": "10m 00s",
    "duration_seconds": 600,
    "distance": 2847,
    "max_altitude": 54.8,
    "max_speed": 15.3,
    "takeoff_time": "2026-02-25T10:30:00.000Z",
    "landing_time": "2026-02-25T10:40:00.000Z"
  },
  "battery": {
    "start_percent": 98,
    "end_percent": 42,
    "min_voltage": 13.62,
    "peak_current": 28.4,
    "voltage_curve": [
      { "timestamp": "2026-02-25T10:30:00.000Z", "voltage": 16.78 }
    ]
  },
  "gps": {
    "track": [
      { "lat": 28.6139, "lon": 77.2090, "timestamp": "2026-02-25T10:30:00.000Z" }
    ],
    "takeoff": { "lat": 28.6139, "lon": 77.2090, "timestamp": "..." },
    "landing": { "lat": 28.6135, "lon": 77.2085, "timestamp": "..." }
  },
  "profile": {
    "altitude": [
      { "timestamp": "...", "altitude": 0.0 }
    ],
    "speed": [
      { "timestamp": "...", "speed": 0.0 }
    ]
  },
  "health": {
    "failsafe": false,
    "gps_satellites": 14,
    "gps_fix": "3D Fix",
    "ekf_ok": true,
    "arming_warnings": [],
    "status_messages": [
      { "severity": "info", "text": "PreArm: Good", "timestamp": "2026-02-25T10:29:45.000Z" }
    ]
  },
  "payload": {
    "images": [
      { "file": "/payload/img_001.jpg", "timestamp": "...", "lat": 28.615, "lon": 77.211 }
    ]
  }
}
```

#### Field Reference

| Path | Type | Unit | Notes |
|------|------|------|-------|
| `mission.status` | string | — | `"Completed"` or `"Aborted"` |
| `mission.duration` | string | — | Human-readable (e.g. `"10m 00s"`) |
| `mission.duration_seconds` | number | s | Raw seconds |
| `mission.distance` | number | m | Total distance in meters |
| `mission.max_altitude` | number | m | Peak altitude AGL |
| `mission.max_speed` | number | m/s | Peak ground speed |
| `mission.takeoff_time` | string | — | ISO 8601 |
| `mission.landing_time` | string | — | ISO 8601 |
| `battery.start_percent` | number | % | 0–100 |
| `battery.end_percent` | number | % | 0–100 |
| `battery.min_voltage` | number | V | Minimum cell voltage |
| `battery.peak_current` | number | A | Peak current draw |
| `battery.voltage_curve[]` | array | — | 100–2000 data points |
| `gps.track[]` | array | — | Up to 50,000 GPS points |
| `gps.track[].lat` | number | ° | Latitude |
| `gps.track[].lon` | number | ° | Longitude |
| `profile.altitude[]` | array | m | Altitude over time |
| `profile.speed[]` | array | m/s | Speed over time |
| `health.failsafe` | boolean | — | true = failsafe was triggered |
| `health.gps_satellites` | number | — | Number of sats locked |
| `health.gps_fix` | string | — | e.g. `"3D Fix"`, `"RTK Fixed"` |
| `health.ekf_ok` | boolean | — | EKF estimator status |
| `health.arming_warnings` | string[] | — | Empty = good |
| `health.status_messages[]` | array | — | ArduPilot STATUSTEXT |
| `health.status_messages[].severity` | string | — | `"info"`, `"warn"`, `"error"` |
| `payload.images[].file` | string | — | URL path to image |

---

### `GET /api/mission/list`

**Purpose:** List available missions for the selector dropdown.

```json
[
  { "id": "2026-02-25_1040", "label": "Flight #3 — 25 Feb 10:40", "timestamp": "2026-02-25T10:40:00.000Z" },
  { "id": "2026-02-24_0930", "label": "Flight #2 — 24 Feb 09:30", "timestamp": "2026-02-24T09:30:00.000Z" }
]
```

---

### `GET /api/mission/:id`

**Purpose:** Fetch a specific mission by ID. Same schema as `/api/mission/latest`.

---

### `GET /api/downloads/raw-log`

Returns the raw `.BIN` flight log file as a downloadable binary.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/octet-stream` |
| `Content-Disposition` | `attachment; filename="flight.BIN"` |

---

### `GET /api/downloads/processed-json`

Returns the processed mission JSON as a downloadable file.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `Content-Disposition` | `attachment; filename="mission.json"` |

---

### `GET /api/downloads/meta`

**Purpose:** File sizes for the download buttons.

```json
{
  "raw_log_mb": 38.2,
  "json_mb": 1.4
}
```

---

### Payload Image Serving

Serve images as static files. If `payload.images[0].file = "/payload/img_001.jpg"`, then:

```
GET /payload/img_001.jpg  →  returns JPEG image
```

---

## 6. API Endpoints Summary Table

| # | Method | Endpoint | Purpose | Poll Rate |
|---|--------|----------|---------|-----------|
| 1 | GET | `/api/mission/state` | Pipeline lifecycle state | Every 2s (while not ready) |
| 2 | GET | `/api/health` | Backend diagnostics | Every 15s |
| 3 | GET | `/api/mission/latest` | Full mission dataset | On load + manual refresh |
| 4 | GET | `/api/mission/list` | Mission selector options | On load |
| 5 | GET | `/api/mission/:id` | Specific mission dataset | On selector change |
| 6 | GET | `/api/downloads/raw-log` | .BIN file download | On click |
| 7 | GET | `/api/downloads/processed-json` | JSON file download | On click |
| 8 | GET | `/api/downloads/meta` | File sizes for UI | On load |
| 9 | GET | `/payload/*` | Static image files | On render |

---

## 7. Dataflow: Pixhawk → Dashboard

```
                    ┌──────────────┐
                    │   Pixhawk    │
                    │  (ArduPilot) │
                    └──────┬───────┘
                           │ MAVLink
                           ▼
                    ┌──────────────┐
                    │ Raspberry Pi │
                    │  or Laptop   │
                    └──────┬───────┘
                           │ .BIN log file
                           ▼
               ┌───────────────────────┐
               │     Backend (you)     │
               │                       │
               │  1. POST /api/mission/state  ← update state
               │     state: downloading → parsing → ready
               │                       │
               │  2. Parse .BIN log    │
               │     ├── Extract GPS   │
               │     ├── Extract BAT   │
               │     ├── Extract ALT   │
               │     ├── Extract STAT  │
               │     └── Save JSON     │
               │                       │
               │  3. Serve endpoints   │
               │     GET /api/mission/latest (JSON)
               │     GET /api/health          │
               │     GET /api/downloads/*     │
               └───────────┬───────────────────┘
                           │ HTTP JSON
                           ▼
               ┌───────────────────────┐
               │   React Dashboard    │
               │   (this codebase)    │
               │                      │
               │  Polls /mission/state │
               │  until "ready"       │
               │  then fetches data   │
               │  and renders UI      │
               └──────────────────────┘
```

---

## 8. Vite Proxy Configuration

If your backend runs on a different port (e.g. Flask on `:5000`), add to `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/payload': 'http://localhost:5000',
    },
  },
});
```

---

## 9. Running the Dashboard

```bash
# Development (with hot reload + mock data fallback)
cd m:\IROC\UAV-dashboard
npm run dev
# → http://localhost:5173/

# Production build (NO mock data — backend required)
npm run build
# Output: dist/ folder (236 KB gzipped)

# Preview production build locally
npm run preview
```

---

## 10. What's NOT in Scope

| Feature | Status | Why |
|---------|--------|-----|
| Live telemetry | ❌ | Post-flight dashboard only |
| Flight control | ❌ | Safety — out of scope |
| User authentication | ❌ | Add if judges require login |
| WebSocket streaming | ❌ | Polling is sufficient for post-flight |
| Backend implementation | ❌ | **Your next task** |

---

## 11. Recommended Backend Stack

| Component | Recommendation | Why |
|-----------|---------------|-----|
| Language | Python 3.10+ | pymavlink ecosystem |
| Framework | Flask or FastAPI | Simple REST API |
| Log parser | pymavlink / mavlogdump | Native ArduPilot support |
| File storage | Local filesystem | Simple, fast |
| Static serving | Flask static_folder | For payload images |

### Backend Priority Order

1. `GET /api/health` — simplest, validates connectivity
2. `GET /api/mission/state` — state machine for pipeline
3. `GET /api/mission/latest` — the core data endpoint
4. `GET /api/downloads/*` — file serving
5. `GET /api/mission/list` + `/:id` — historical flights
6. `GET /api/downloads/meta` — file sizes (nice-to-have)

---

## 12. One-Line Summary

**PRD v1 built the dashboard. PRD v2 made it survive real UAV data. Frontend is frozen — build the backend.**
