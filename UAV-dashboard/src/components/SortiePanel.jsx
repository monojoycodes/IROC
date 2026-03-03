import { useState, useEffect, useCallback } from 'react';
import { Rocket, Play, RotateCcw, CheckCircle2, Clock, Crosshair } from 'lucide-react';
import { fetchSorties, startSortie, simulateTrigger, simulateReset } from '../services/ascend';

export default function SortiePanel() {
    const [sorties, setSorties] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadSorties = useCallback(async () => {
        try {
            const data = await fetchSorties();
            setSorties(data.sorties || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadSorties(); }, [loadSorties]);

    const handleStartSortie = async () => {
        setLoading(true);
        try {
            await startSortie();
            await loadSorties();
        } finally { setLoading(false); }
    };

    const handleSimTrigger = async () => {
        setLoading(true);
        try {
            await simulateTrigger();
        } finally { setLoading(false); }
    };

    const handleSimReset = async () => {
        try {
            await simulateReset();
        } catch { /* silent */ }
    };

    const statusColor = {
        in_progress: '#f59e0b',
        completed: '#22c55e',
    };

    return (
        <section className="section" id="sorties">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: 'var(--accent-purple)' }}>
                    <Rocket size={18} />
                </div>
                <h2>Sorties</h2>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={handleStartSortie} disabled={loading} style={{ fontSize: '0.78rem' }}>
                    <Play size={13} /> New Sortie
                </button>
                <button className="btn btn-ghost" onClick={handleSimTrigger} disabled={loading} style={{ fontSize: '0.78rem' }}>
                    <Rocket size={13} /> Simulate Flight
                </button>
                <button className="btn btn-ghost" onClick={handleSimReset} style={{ fontSize: '0.78rem' }}>
                    <RotateCcw size={13} /> Reset State
                </button>
            </div>

            {/* Sortie list */}
            {sorties.length === 0 ? (
                <div className="card-flat" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                    No sorties yet. Click "New Sortie" before takeoff.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sorties.map(s => (
                        <div
                            className="card-flat"
                            key={s.sortie_id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                            }}
                        >
                            {s.status === 'completed' ? (
                                <CheckCircle2 size={18} color="#22c55e" />
                            ) : (
                                <Clock size={18} color="#f59e0b" />
                            )}
                            <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.sortie_id}</span>
                                <span style={{
                                    marginLeft: 8, fontSize: '0.68rem', fontWeight: 600,
                                    color: statusColor[s.status] || 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                }}>
                                    {s.status}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <Crosshair size={12} />
                                {s.detection_count} detections
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(s.started_at).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
