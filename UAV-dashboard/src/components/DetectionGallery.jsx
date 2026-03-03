import { useState, useEffect, useCallback } from 'react';
import { Crosshair, Clock, MapPin, X, ChevronDown } from 'lucide-react';
import { fetchSorties, fetchSortie } from '../services/ascend';

export default function DetectionGallery() {
    const [sorties, setSorties] = useState([]);
    const [activeSortie, setActiveSortie] = useState(null);
    const [detections, setDetections] = useState([]);
    const [preview, setPreview] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const loadSorties = useCallback(async () => {
        try {
            const data = await fetchSorties();
            setSorties(data.sorties || []);
            // Auto-select latest sortie with detections
            const withDets = (data.sorties || []).filter(s => s.detection_count > 0);
            if (withDets.length > 0 && !activeSortie) {
                selectSortie(withDets[0].sortie_id);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadSorties(); }, [loadSorties]);

    const selectSortie = async (sortieId) => {
        setActiveSortie(sortieId);
        setDropdownOpen(false);
        try {
            const data = await fetchSortie(sortieId);
            setDetections(data.detections || []);
        } catch {
            setDetections([]);
        }
    };

    const featureColors = {
        rock_formation: '#f59e0b',
        red_oxide: '#ef4444',
        ice_patch: '#06b6d4',
        unknown: '#8b5cf6',
    };

    const featureLabel = (type) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    if (sorties.length === 0) {
        return (
            <section className="section" id="detections">
                <div className="section-header">
                    <div className="section-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                        <Crosshair size={18} />
                    </div>
                    <h2>Detections</h2>
                </div>
                <div className="card-flat" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                    No sorties recorded yet. Detections will appear here after a sortie is completed.
                </div>
            </section>
        );
    }

    return (
        <section className="section" id="detections">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                    <Crosshair size={18} />
                </div>
                <h2>Detections</h2>

                {/* Sortie selector */}
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                        {activeSortie || 'Select Sortie'} <ChevronDown size={12} />
                    </button>
                    {dropdownOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, zIndex: 50,
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)', padding: 4, minWidth: 160,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        }}>
                            {sorties.map(s => (
                                <button
                                    key={s.sortie_id}
                                    onClick={() => selectSortie(s.sortie_id)}
                                    style={{
                                        width: '100%', padding: '8px 12px', border: 'none',
                                        background: s.sortie_id === activeSortie ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                                        color: 'var(--text-primary)', fontSize: '0.75rem',
                                        cursor: 'pointer', borderRadius: 4, textAlign: 'left',
                                        display: 'flex', justifyContent: 'space-between',
                                    }}
                                >
                                    <span>{s.sortie_id}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{s.detection_count} det.</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {detections.length === 0 ? (
                <div className="card-flat" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                    No detections in {activeSortie || 'selected sortie'}.
                </div>
            ) : (
                <div className="grid-3">
                    {detections.map((det, i) => {
                        const color = featureColors[det.feature_type] || featureColors.unknown;
                        return (
                            <div
                                className="card"
                                key={det.detection_id || i}
                                onClick={() => setPreview(det)}
                                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={det.image_file}
                                        alt={`Detection ${i + 1}`}
                                        style={{ width: '100%', height: 160, objectFit: 'cover' }}
                                        loading="lazy"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                    <span style={{
                                        position: 'absolute', top: 8, left: 8,
                                        background: color, color: '#fff',
                                        padding: '2px 8px', borderRadius: 4,
                                        fontSize: '0.65rem', fontWeight: 600,
                                        textTransform: 'uppercase', letterSpacing: '0.5px',
                                    }}>
                                        {featureLabel(det.feature_type)}
                                    </span>
                                </div>
                                <div style={{ padding: '10px 14px' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {det.detection_id}
                                    </span>
                                    <div style={{ display: 'flex', gap: 12, fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <MapPin size={10} />
                                            ({det.local_x?.toFixed(1)}, {det.local_y?.toFixed(1)}, {det.local_z?.toFixed(1)}) m
                                        </span>
                                        {det.timestamp && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Clock size={10} />
                                                {new Date(det.timestamp).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Preview modal */}
            {preview && (
                <div className="modal-overlay" onClick={() => setPreview(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, overflow: 'hidden' }}>
                        <div style={{ position: 'relative' }}>
                            <img src={preview.image_file} alt="Detection" style={{ width: '100%', height: 'auto' }} />
                            <button
                                onClick={() => setPreview(null)}
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
                        <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{
                                    background: featureColors[preview.feature_type] || '#8b5cf6',
                                    color: '#fff', padding: '3px 10px', borderRadius: 4,
                                    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                                }}>
                                    {featureLabel(preview.feature_type)}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{preview.detection_id}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={12} />
                                    Local: ({preview.local_x?.toFixed(2)}, {preview.local_y?.toFixed(2)}, {preview.local_z?.toFixed(2)}) m
                                </span>
                                {preview.timestamp && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={12} />
                                        {new Date(preview.timestamp).toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
