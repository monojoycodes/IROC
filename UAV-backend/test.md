# Testing the ASCEND Backend

These are step-by-step instructions to test every ASCEND-specific endpoint.
All commands use PowerShell. The backend must be running on `http://localhost:8000`.

---

## Prerequisites

```powershell
cd m:\IROC\UAV-backend
python -m uvicorn main:app --reload --port 8000
```

You need a few test images. Create them quickly:

```powershell
# Generate simple test images (or use any .jpg/.png files you have)
# If you have real images, skip this step and use those paths instead
```

---

## 1. Seed Image Management

### 1a. Upload seed images

```powershell
# Upload seed images (use any image files you have)
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/seeds/upload `
  -Form @{ files = Get-Item "path\to\seed1.jpg" }
```

Or use the **Swagger UI** at `http://localhost:8000/docs`:
1. Find `POST /api/seeds/upload`
2. Click "Try it out"
3. Upload 3-5 images
4. Click Execute

**Expected:** Returns `{"uploaded": N, "files": [...]}` with URLs for each image.

### 1b. List seed images

```powershell
Invoke-RestMethod -Uri http://localhost:8000/api/seeds/list
```

**Expected:** Returns `{"seeds": [...], "count": N}` listing all uploaded images.

### 1c. View a seed image in browser

Open: `http://localhost:8000/seeds/<filename.jpg>`

**Expected:** Image displays directly in the browser.

### 1d. Delete a seed image

```powershell
Invoke-RestMethod -Method DELETE -Uri http://localhost:8000/api/seeds/seed1.jpg
```

**Expected:** Returns `{"deleted": "seed1.jpg"}`

### 1e. Clear all seeds

```powershell
Invoke-RestMethod -Method DELETE -Uri http://localhost:8000/api/seeds
```

**Expected:** Returns `{"status": "cleared"}`

---

## 2. Sortie Management

### 2a. Start a new sortie

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/sortie/start
```

**Expected:** Returns sortie data with `sortie_id: "S001"`, `status: "in_progress"`.

### 2b. List all sorties

```powershell
Invoke-RestMethod -Uri http://localhost:8000/api/sortie/list
```

**Expected:** Returns array of sorties with detection counts.

### 2c. Get sortie details

```powershell
Invoke-RestMethod -Uri http://localhost:8000/api/sortie/S001
```

**Expected:** Returns full sortie data including detections array.

---

## 3. Detection Image Upload

### 3a. Upload a single detection

```powershell
# Single detection upload (simulates RPi sending one detection at a time)
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/detections/upload `
  -Form @{
    sortie_id = "S001"
    feature_type = "rock_formation"
    local_x = "3.2"
    local_y = "-1.5"
    local_z = "0.8"
    image = Get-Item "path\to\detection1.jpg"
  }
```

**Expected:** Returns detection record with `detection_id`, coordinates, and image URL.

### 3b. View detection image in browser

Open: `http://localhost:8000/detections/S001/det_001.jpg`

**Expected:** Detection image displays directly.

### 3c. Batch upload (post-flight data transfer from RPi)

```powershell
# Batch upload simulates RPi transferring all detections after landing
$detection_log = '[
  {"feature_type": "rock_formation", "local_x": 3.2, "local_y": -1.5, "local_z": 0.8},
  {"feature_type": "red_oxide", "local_x": -2.1, "local_y": 4.3, "local_z": 0.5},
  {"feature_type": "ice_patch", "local_x": 1.0, "local_y": -3.7, "local_z": 0.6}
]'

Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/detections/batch `
  -Form @{
    sortie_id = "S001"
    detection_log = $detection_log
    images = (Get-Item "det1.jpg"), (Get-Item "det2.jpg"), (Get-Item "det3.jpg")
  }
```

**Expected:** Returns all 3 detections added, sortie marked as `"completed"`.

### 3d. List detections for a sortie

```powershell
Invoke-RestMethod -Uri http://localhost:8000/api/detections/S001
```

**Expected:** Returns all detections with image URLs and coordinates.

---

## 4. Full End-to-End Test

This simulates a complete ASCEND sortie:

```powershell
# Step 1: Upload seed images (operator does this before flight)
Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/seeds/upload `
  -Form @{ files = Get-Item "seed_rock.jpg" }

# Step 2: Start a sortie (before takeoff)
$sortie = Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/sortie/start
$sid = $sortie.sortie_id
Write-Host "Sortie started: $sid"

# Step 3: UAV flies and RPi detects features...
# Step 4: After landing, RPi uploads all detections

Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/detections/upload `
  -Form @{
    sortie_id = $sid
    feature_type = "rock_formation"
    local_x = "3.2"
    local_y = "-1.5"
    local_z = "0.8"
    image = Get-Item "detection.jpg"
  }

# Step 5: Check results
Invoke-RestMethod -Uri http://localhost:8000/api/sortie/$sid
Invoke-RestMethod -Uri http://localhost:8000/api/detections/$sid

# Step 6: Repeat for next sortie
$sortie2 = Invoke-RestMethod -Method POST -Uri http://localhost:8000/api/sortie/start
```

---

## 5. Swagger UI (Easiest Way to Test)

Open `http://localhost:8000/docs` in your browser. All endpoints are interactive:
- File uploads have drag-and-drop fields
- Form parameters have input boxes
- Click "Try it out" → fill in → "Execute"

This is the **easiest** way to test without writing PowerShell commands.

---

## 6. Verify on Dashboard

After uploading detections, open `http://localhost:5173`:
- The payload gallery should show detection images (once the dashboard is connected)
- The mission overview should reflect sortie data

> **Note:** The dashboard frontend may need updates to consume the new `/api/sortie/*` and `/api/detections/*` endpoints. Currently it reads from `/api/mission/latest` which shows the flight telemetry, not ASCEND-specific data.
