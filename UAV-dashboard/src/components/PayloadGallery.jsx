import { useState, useEffect, useCallback } from 'react';
import { Camera, Clock, X, RefreshCw, ChevronDown, ChevronUp, Trash2, Image, Wifi } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const POLL_INTERVAL = 5000; // 5 seconds

async function fetchPayloadSessions() {
    const res = await fetch(`${API_BASE}/api/payload/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function deleteSession(sessionId) {
    const res = await fetch(`${API_BASE}/api/payload/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function formatSessionLabel(sessionId) {
    // SESSION_20260401_190155 → Apr 1, 2026 · 19:01
    const match = sessionId.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!match) return sessionId;
    const [, y, mo, d, h, mi] = match;
    const date = new Date(+y, +mo - 1, +d, +h, +mi);
    return date.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

function ImageCard({ img, index, onClick }) {
    const [errored, setErrored] = useState(false);
    return (
        <div
            className="payload-img-card"
            onClick={() => onClick(img)}
            title={img.filename}
        >
            {errored ? (
                <div className="payload-img-placeholder">
                    <Image size={28} style={{ color: 'var(--text-muted)' }} />
                </div>
            ) : (
                <img
                    src={`${API_BASE}${img.url}`}
                    alt={img.filename}
                    className="payload-img-thumb"
                    loading="lazy"
                    onError={() => setErrored(true)}
                />
            )}
            <div className="payload-img-meta">
                <span className="payload-img-name">{img.filename}</span>
                <span className="payload-img-info">
                    <Clock size={10} />
                    {new Date(img.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    {img.size_kb && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{img.size_kb} KB</span>}
                </span>
            </div>
        </div>
    );
}

function SessionGroup({ session, onDelete }) {
    const [collapsed, setCollapsed] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete session "${session.session_id}" and all ${session.image_count} image(s)?`)) return;
        setDeleting(true);
        try {
            await deleteSession(session.session_id);
            onDelete(session.session_id);
        } catch (err) {
            alert(`Failed to delete session: ${err.message}`);
            setDeleting(false);
        }
    };

    return (
        <div className="payload-session">
            <div className="payload-session-header" onClick={() => setCollapsed(c => !c)}>
                <div className="payload-session-title">
                    <span className="payload-session-dot" />
                    <span className="payload-session-label">{formatSessionLabel(session.session_id)}</span>
                    <span className="payload-session-badge">{session.image_count} image{session.image_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="payload-session-actions">
                    <button
                        className="payload-delete-btn"
                        onClick={handleDelete}
                        disabled={deleting}
                        title="Delete session"
                    >
                        <Trash2 size={13} />
                    </button>
                    {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </div>
            </div>

            {!collapsed && (
                <div className="payload-img-grid">
                    {session.images.map((img, i) => (
                        <ImageCardModal key={img.filename} img={img} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ImageCard with built-in modal
function ImageCardModal({ img }) {
    const [open, setOpen] = useState(false);
    const [errored, setErrored] = useState(false);

    return (
        <>
            <div className="payload-img-card" onClick={() => setOpen(true)} title={img.filename}>
                {errored ? (
                    <div className="payload-img-placeholder">
                        <Image size={28} style={{ color: 'var(--text-muted)' }} />
                    </div>
                ) : (
                    <img
                        src={`${API_BASE}${img.url}`}
                        alt={img.filename}
                        className="payload-img-thumb"
                        loading="lazy"
                        onError={() => setErrored(true)}
                    />
                )}
                <div className="payload-img-meta">
                    <span className="payload-img-name">{img.filename}</span>
                    <span className="payload-img-info">
                        <Clock size={10} />
                        {new Date(img.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        {img.size_kb && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{img.size_kb} KB</span>}
                    </span>
                </div>
            </div>

            {open && (
                <div className="modal-overlay" onClick={() => setOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, padding: 0, overflow: 'hidden' }}>
                        <div style={{ position: 'relative' }}>
                            {errored ? (
                                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)' }}>
                                    <Image size={48} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            ) : (
                                <img
                                    src={`${API_BASE}${img.url}`}
                                    alt={img.filename}
                                    style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', background: '#000' }}
                                    onError={() => setErrored(true)}
                                />
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                style={{
                                    position: 'absolute', top: 12, right: 12, width: 32, height: 32,
                                    borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{img.filename}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} /> {new Date(img.timestamp).toLocaleString()}
                            </span>
                            {img.size_kb && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{img.size_kb} KB</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <div className="payload-empty">
            <div className="payload-empty-icon">
                <Wifi size={32} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>No Images Transferred Yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                Run <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-cyan)' }}>rpi_image_push.py</code> on
                the Raspberry Pi to transfer images over WiFi.
            </p>
            <div className="payload-empty-cmd">
                <span style={{ color: 'var(--accent-green)', userSelect: 'all' }}>
                    python rpi_image_push.py --dir /home/pi/captures --gcs http://&lt;GCS_IP&gt;:8000
                </span>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PayloadGallery() {
    const [sessions, setSessions] = useState([]);
    const [totalImages, setTotalImages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    const load = useCallback(async () => {
        try {
            const data = await fetchPayloadSessions();
            setSessions(data.sessions ?? []);
            setTotalImages(data.total_images ?? 0);
            setLastRefresh(new Date());
            setError(null);
        } catch (err) {
            setError('Cannot reach backend.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load + 5s polling
    useEffect(() => {
        load();
        const id = setInterval(load, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [load]);

    const handleDelete = (sessionId) => {
        setSessions(prev => prev.filter(s => s.session_id !== sessionId));
    };

    return (
        <section className="section" id="payload">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--accent-cyan)' }}>
                    <Camera size={18} />
                </div>
                <h2>Payload / Images</h2>
                {totalImages > 0 && (
                    <span className="badge badge-info" style={{ marginLeft: 8 }}>{totalImages} total</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {lastRefresh && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </span>
                    )}
                    <button
                        className="btn btn-ghost"
                        onClick={load}
                        disabled={loading}
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        title="Refresh images"
                    >
                        <RefreshCw size={13} className={loading ? 'spinning' : ''} />
                    </button>
                </div>
            </div>

            {error ? (
                <div className="card-flat" style={{ textAlign: 'center', color: 'var(--accent-red)', padding: 'var(--space-xl)' }}>
                    {error}
                </div>
            ) : loading && sessions.length === 0 ? (
                <div className="card-flat" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    Loading images…
                </div>
            ) : sessions.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="payload-sessions-list">
                    {sessions.map(session => (
                        <SessionGroup
                            key={session.session_id}
                            session={session}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
