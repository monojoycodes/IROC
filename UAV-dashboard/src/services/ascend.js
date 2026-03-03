// ═══════════════════════════════════════════════════════════
// ASCEND Service — Seed images, sorties, detections
// ═══════════════════════════════════════════════════════════

const API_BASE = '/api';

// ── Seed Images ──────────────────────────────────────────

export async function fetchSeeds() {
    const res = await fetch(`${API_BASE}/seeds/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

export async function uploadSeeds(files) {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    const res = await fetch(`${API_BASE}/seeds/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

export async function deleteSeed(filename) {
    const res = await fetch(`${API_BASE}/seeds/${filename}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

export async function clearAllSeeds() {
    const res = await fetch(`${API_BASE}/seeds`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

// ── Sorties ──────────────────────────────────────────────

export async function startSortie() {
    const res = await fetch(`${API_BASE}/sortie/start`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

export async function fetchSorties() {
    const res = await fetch(`${API_BASE}/sortie/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

export async function fetchSortie(sortieId) {
    const res = await fetch(`${API_BASE}/sortie/${sortieId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

// ── Detections ───────────────────────────────────────────

export async function fetchDetections(sortieId) {
    const res = await fetch(`${API_BASE}/detections/${sortieId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

// ── Simulation Controls ──────────────────────────────────

export async function simulateTrigger() {
    const res = await fetch(`${API_BASE}/simulate/trigger`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

export async function simulateReset() {
    const res = await fetch(`${API_BASE}/simulate/reset`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}
