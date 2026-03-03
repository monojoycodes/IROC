// ═══════════════════════════════════════════════════════════
// Missions Service — Mission state + listing
// ═══════════════════════════════════════════════════════════

const API_BASE = '/api';

/**
 * Fetch mission pipeline state.
 * Returns: { state: 'idle'|'downloading'|'parsing'|'ready'|'error', progress: 0-1, message: '' }
 */
export async function fetchMissionState() {
    try {
        const res = await fetch(`${API_BASE}/mission/state`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return null; // backend unreachable
    }
}

/**
 * Fetch list of available missions for the selector dropdown.
 * Returns: [{ id, label, timestamp }]
 */
export async function fetchMissionList() {
    try {
        const res = await fetch(`${API_BASE}/mission/list`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return [];
    }
}

/**
 * Fetch a specific mission by ID.
 */
export async function fetchMissionById(id) {
    const res = await fetch(`${API_BASE}/mission/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
}

/**
 * Fetch download metadata (file sizes).
 * Returns: { raw_log_mb, json_mb }
 */
export async function fetchDownloadMeta() {
    try {
        const res = await fetch(`${API_BASE}/downloads/meta`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return null;
    }
}
