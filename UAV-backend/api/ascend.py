# ═══════════════════════════════════════════════════════════
# ASCEND Routes — Seed images + Detection ingestion
# ═══════════════════════════════════════════════════════════
# Seeding:   Operator uploads reference images → served to RPi
# Detection: RPi uploads detected feature images + coords → shown on dashboard

import os
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

STORAGE_DIR = Path(__file__).parent.parent / "storage"
SEEDS_DIR = STORAGE_DIR / "seeds"
DETECTIONS_DIR = STORAGE_DIR / "detections"
SORTIES_DIR = STORAGE_DIR / "sorties"


# ═══════════════════════════════════════════════════════════
# SEED IMAGE MANAGEMENT — Reference images for the RPi
# ═══════════════════════════════════════════════════════════


@router.post("/seeds/upload")
async def upload_seeds(files: List[UploadFile] = File(...)):
    """
    Upload 3-5 reference/seed images that define the feature types
    the UAV should search for. These are served to the RPi before flight.
    """
    SEEDS_DIR.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            continue

        content = await f.read()
        dest = SEEDS_DIR / f.filename
        dest.write_bytes(content)

        saved.append({
            "filename": f.filename,
            "size_kb": round(len(content) / 1024, 1),
            "url": f"/seeds/{f.filename}",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        })

    logger.info(f"Uploaded {len(saved)} seed images")
    return {"uploaded": len(saved), "files": saved}


@router.get("/seeds/list")
async def list_seeds():
    """List all uploaded seed images."""
    if not SEEDS_DIR.exists():
        return {"seeds": [], "count": 0}

    seeds = []
    for f in sorted(SEEDS_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
            seeds.append({
                "filename": f.name,
                "url": f"/seeds/{f.name}",
                "size_kb": round(f.stat().st_size / 1024, 1),
                "uploaded_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
            })

    return {"seeds": seeds, "count": len(seeds)}


@router.delete("/seeds/{filename}")
async def delete_seed(filename: str):
    """Remove a seed image."""
    path = SEEDS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Seed image '{filename}' not found.")
    path.unlink()
    return {"deleted": filename}


@router.delete("/seeds")
async def clear_all_seeds():
    """Clear all seed images (fresh start for new round)."""
    if SEEDS_DIR.exists():
        shutil.rmtree(SEEDS_DIR)
        SEEDS_DIR.mkdir(parents=True, exist_ok=True)
    return {"status": "cleared"}


# ═══════════════════════════════════════════════════════════
# SORTIE MANAGEMENT — Track multiple flights
# ═══════════════════════════════════════════════════════════


@router.post("/sortie/start")
async def start_sortie():
    """
    Start a new sortie. Called before UAV takeoff.
    Returns a sortie_id to tag detections during this flight.
    """
    SORTIES_DIR.mkdir(parents=True, exist_ok=True)

    # Generate sortie ID
    existing = list(SORTIES_DIR.glob("S*.json"))
    sortie_num = len(existing) + 1
    sortie_id = f"S{sortie_num:03d}"

    sortie_data = {
        "sortie_id": sortie_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "status": "in_progress",
        "detections": [],
    }

    sortie_path = SORTIES_DIR / f"{sortie_id}.json"
    sortie_path.write_text(json.dumps(sortie_data, indent=2), encoding="utf-8")

    logger.info(f"Sortie {sortie_id} started")
    return sortie_data


@router.get("/sortie/list")
async def list_sorties():
    """List all sorties with summary info."""
    if not SORTIES_DIR.exists():
        return {"sorties": [], "count": 0}

    sorties = []
    for f in sorted(SORTIES_DIR.glob("S*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            sorties.append({
                "sortie_id": data["sortie_id"],
                "started_at": data["started_at"],
                "ended_at": data.get("ended_at"),
                "status": data["status"],
                "detection_count": len(data.get("detections", [])),
            })
        except (json.JSONDecodeError, KeyError):
            continue

    return {"sorties": sorties, "count": len(sorties)}


@router.get("/sortie/{sortie_id}")
async def get_sortie(sortie_id: str):
    """Get full sortie data including all detections."""
    path = SORTIES_DIR / f"{sortie_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Sortie '{sortie_id}' not found.")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/sortie/current")
async def get_current_sortie():
    """Get the latest in-progress sortie."""
    if not SORTIES_DIR.exists():
        raise HTTPException(status_code=404, detail="No sorties found.")

    for f in sorted(SORTIES_DIR.glob("S*.json"), reverse=True):
        data = json.loads(f.read_text(encoding="utf-8"))
        if data.get("status") == "in_progress":
            return data

    raise HTTPException(status_code=404, detail="No active sortie.")


# ═══════════════════════════════════════════════════════════
# DETECTION INGESTION — Images + coords from RPi
# ═══════════════════════════════════════════════════════════


@router.post("/detections/upload")
async def upload_detection(
    sortie_id: str = Form(...),
    feature_type: str = Form(...),
    local_x: float = Form(...),
    local_y: float = Form(...),
    local_z: float = Form(0.0),
    timestamp: Optional[str] = Form(None),
    image: UploadFile = File(...),
):
    """
    Upload a single detection from the RPi.
    Called once per detected feature during/after a sortie.

    Args:
        sortie_id: Which sortie this detection belongs to (e.g., "S001")
        feature_type: What was detected (e.g., "rock_formation", "red_oxide", "ice_patch")
        local_x: VIO X position in meters (relative to base station)
        local_y: VIO Y position in meters
        local_z: VIO Z position in meters (altitude)
        timestamp: ISO timestamp of detection (defaults to now)
        image: The verification image captured by the UAV
    """
    # Validate sortie exists
    sortie_path = SORTIES_DIR / f"{sortie_id}.json"
    if not sortie_path.exists():
        raise HTTPException(status_code=404, detail=f"Sortie '{sortie_id}' not found. Call POST /api/sortie/start first.")

    # Save detection image
    det_dir = DETECTIONS_DIR / sortie_id
    det_dir.mkdir(parents=True, exist_ok=True)

    sortie_data = json.loads(sortie_path.read_text(encoding="utf-8"))
    det_num = len(sortie_data.get("detections", [])) + 1
    ext = Path(image.filename).suffix or ".jpg"
    img_filename = f"det_{det_num:03d}{ext}"

    content = await image.read()
    (det_dir / img_filename).write_bytes(content)

    # Build detection record
    detection = {
        "detection_id": f"{sortie_id}_D{det_num:03d}",
        "feature_type": feature_type,
        "local_x": local_x,
        "local_y": local_y,
        "local_z": local_z,
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
        "image_file": f"/detections/{sortie_id}/{img_filename}",
        "image_size_kb": round(len(content) / 1024, 1),
    }

    # Append to sortie
    sortie_data["detections"].append(detection)
    sortie_path.write_text(json.dumps(sortie_data, indent=2), encoding="utf-8")

    logger.info(f"Detection {detection['detection_id']}: {feature_type} at ({local_x}, {local_y}, {local_z})")
    return detection


@router.post("/detections/batch")
async def upload_detections_batch(
    sortie_id: str = Form(...),
    detection_log: str = Form(...),
    images: List[UploadFile] = File(...),
):
    """
    Batch upload all detections from a sortie at once.
    Used for the "Return Task" — RPi transfers everything after landing.

    Args:
        sortie_id: Sortie identifier
        detection_log: JSON string with array of detections:
            [{"feature_type": "...", "local_x": 1.2, "local_y": -3.4, "local_z": 0.5, "timestamp": "..."}, ...]
        images: List of detection images, in same order as detection_log entries
    """
    sortie_path = SORTIES_DIR / f"{sortie_id}.json"
    if not sortie_path.exists():
        raise HTTPException(status_code=404, detail=f"Sortie '{sortie_id}' not found.")

    try:
        log_entries = json.loads(detection_log)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in detection_log.")

    if len(log_entries) != len(images):
        raise HTTPException(
            status_code=400,
            detail=f"Mismatch: {len(log_entries)} log entries but {len(images)} images.",
        )

    det_dir = DETECTIONS_DIR / sortie_id
    det_dir.mkdir(parents=True, exist_ok=True)

    sortie_data = json.loads(sortie_path.read_text(encoding="utf-8"))
    results = []

    for i, (entry, img) in enumerate(zip(log_entries, images)):
        det_num = len(sortie_data.get("detections", [])) + 1
        ext = Path(img.filename).suffix or ".jpg"
        img_filename = f"det_{det_num:03d}{ext}"

        content = await img.read()
        (det_dir / img_filename).write_bytes(content)

        detection = {
            "detection_id": f"{sortie_id}_D{det_num:03d}",
            "feature_type": entry.get("feature_type", "unknown"),
            "local_x": entry.get("local_x", 0),
            "local_y": entry.get("local_y", 0),
            "local_z": entry.get("local_z", 0),
            "timestamp": entry.get("timestamp", datetime.now(timezone.utc).isoformat()),
            "image_file": f"/detections/{sortie_id}/{img_filename}",
            "image_size_kb": round(len(content) / 1024, 1),
        }

        sortie_data["detections"].append(detection)
        results.append(detection)

    # Mark sortie as completed
    sortie_data["ended_at"] = datetime.now(timezone.utc).isoformat()
    sortie_data["status"] = "completed"
    sortie_path.write_text(json.dumps(sortie_data, indent=2), encoding="utf-8")

    logger.info(f"Batch upload: {len(results)} detections for {sortie_id}")
    return {"sortie_id": sortie_id, "detections_added": len(results), "detections": results}


@router.get("/detections/{sortie_id}")
async def list_detections(sortie_id: str):
    """List all detections for a specific sortie."""
    sortie_path = SORTIES_DIR / f"{sortie_id}.json"
    if not sortie_path.exists():
        raise HTTPException(status_code=404, detail=f"Sortie '{sortie_id}' not found.")

    data = json.loads(sortie_path.read_text(encoding="utf-8"))
    return {"sortie_id": sortie_id, "detections": data.get("detections", [])}
