# ═══════════════════════════════════════════════════════════
# UAV Post-Flight Backend — FastAPI Entry Point
# ═══════════════════════════════════════════════════════════
# Start: uvicorn main:app --reload --port 8000
#
# Environment variables:
#   MAVLINK_CONNECTION  — e.g. "udp:127.0.0.1:14550" or "com3"
#                          If unset, runs in simulation mode.

import os
import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import router as api_router
from api.ascend import router as ascend_router
from workers.mission_worker import start_mission_worker

# ── Logging ───────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("uav-backend")

# ── Storage directories ──────────────────────────────────

STORAGE_DIR = Path(__file__).parent / "storage"
LOGS_DIR = STORAGE_DIR / "logs"
MISSIONS_DIR = STORAGE_DIR / "missions"
PAYLOAD_DIR = STORAGE_DIR / "payload"
SEEDS_DIR = STORAGE_DIR / "seeds"
DETECTIONS_DIR = STORAGE_DIR / "detections"
SORTIES_DIR = STORAGE_DIR / "sorties"


def _ensure_storage():
    """Create storage directories if they don't exist."""
    for d in [LOGS_DIR, MISSIONS_DIR, PAYLOAD_DIR, SEEDS_DIR, DETECTIONS_DIR, SORTIES_DIR]:
        d.mkdir(parents=True, exist_ok=True)
        logger.info(f"  📁 {d}")


# ── Lifespan ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: setup on start, cleanup on shutdown."""
    logger.info("═" * 50)
    logger.info("  UAV Post-Flight Backend Starting")
    logger.info("═" * 50)

    # Create storage directories
    _ensure_storage()

    # Determine mode
    connection = os.environ.get("MAVLINK_CONNECTION")
    if connection:
        logger.info(f"🔌 LIVE MODE — MAVLink: {connection}")
    else:
        logger.info("🧪 SIMULATION MODE — No MAVLink connection configured")
        logger.info("   Set MAVLINK_CONNECTION env var for live mode")

    # Spawn background worker
    worker_task = asyncio.create_task(start_mission_worker(connection))
    logger.info("✅ Background worker started")

    logger.info("═" * 50)
    logger.info("  Backend ready. Serving API on /api")
    logger.info("═" * 50)

    yield  # App is running

    # Shutdown
    logger.info("Shutting down background worker…")
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    logger.info("Backend shutdown complete.")


# ── FastAPI App ───────────────────────────────────────────

app = FastAPI(
    title="UAV Post-Flight Backend",
    description="Mission ingestion and processing engine for Pixhawk flight logs.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for local base-station use
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)
app.include_router(ascend_router)

# Static file serving
app.mount("/payload", StaticFiles(directory=str(PAYLOAD_DIR), check_dir=False), name="payload")
app.mount("/seeds", StaticFiles(directory=str(SEEDS_DIR), check_dir=False), name="seeds")
app.mount("/detections", StaticFiles(directory=str(DETECTIONS_DIR), check_dir=False), name="detections")


# ── Root endpoint ─────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "UAV Post-Flight Backend",
        "version": "1.0.0",
        "docs": "/docs",
    }
