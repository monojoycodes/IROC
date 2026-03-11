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
