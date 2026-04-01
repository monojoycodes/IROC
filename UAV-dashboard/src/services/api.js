// ═══════════════════════════════════════════════════════════
// API Service — Fetch mission data
// ═══════════════════════════════════════════════════════════
// PRD v2: No silent mock fallback in production.
// Mock data only used in development mode.

import mockMission from '../data/mockMission';

const API_BASE = '/api';

/**
 * Fetch the latest mission data.
 * - In DEV: falls back to mock data if backend unreachable.
 * - In PROD: throws error (failures must be visible).
 */
export async function fetchMission() {
    try {
        const res = await fetch(`${API_BASE}/mission/latest`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        if (import.meta.env.PROD) {
            throw new Error(`Backend unreachable: ${err.message}. Ensure the backend is running.`);
        }
        console.info('[api] Backend unavailable — using mock mission data (dev only)');
        await new Promise((r) => setTimeout(r, 800));
        return mockMission;
    }
}

/**
 * Fetch a specific mission by ID.
 */
export async function fetchMissionById(id) {
    try {
        const res = await fetch(`${API_BASE}/mission/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        if (import.meta.env.PROD) throw err;
        console.info('[api] Falling back to mock for mission', id);
        await new Promise((r) => setTimeout(r, 400));
        return mockMission;
    }
}

/**
 * Upload a raw .BIN log file manually.
 */
export async function uploadBinLog(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/log`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Download URL helpers
 */
export const downloadUrls = {
    rawLog: `${API_BASE}/downloads/raw-log`,
    processedJson: `${API_BASE}/downloads/processed-json`,
};
