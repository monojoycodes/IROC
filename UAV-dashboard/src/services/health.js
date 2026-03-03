// ═══════════════════════════════════════════════════════════
// Health Service — Backend health check
// ═══════════════════════════════════════════════════════════

const API_BASE = '/api';

/**
 * Check backend health.
 * Returns health object or null if unreachable.
 */
export async function fetchHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch {
        return null;
    }
}
