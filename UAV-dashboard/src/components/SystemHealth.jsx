import { useState } from 'react';
import {
    ShieldCheck, Satellite, Cpu, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import LogTimeline from './LogTimeline';

const healthCards = [
    {
        key: 'failsafe',
        label: 'Failsafe Triggered',
        icon: AlertTriangle,
        render: (v) => (v ? 'YES' : 'NO'),
        color: (v) => (v ? 'var(--accent-red)' : 'var(--accent-green)'),
        bg: (v) => (v ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)'),
        dotColor: (v) => (v ? 'red' : 'green'),
    },
    {
        key: 'gps',
        label: 'GPS Quality',
        icon: Satellite,
        render: (_, d) => `${d.gps_satellites} sats · ${d.gps_fix || '3D Fix'}`,
        color: () => 'var(--accent-blue)',
        bg: () => 'var(--accent-blue-dim)',
        dotColor: (_, d) => (d.gps_satellites >= 10 ? 'green' : d.gps_satellites >= 6 ? 'amber' : 'red'),
    },
    {
        key: 'ekf_ok',
        label: 'EKF Status',
        icon: Cpu,
        render: (v) => (v ? 'OK' : 'FAIL'),
        color: (v) => (v ? 'var(--accent-green)' : 'var(--accent-red)'),
        bg: (v) => (v ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)'),
        dotColor: (v) => (v ? 'green' : 'red'),
    },
    {
        key: 'arming_warnings',
        label: 'Arming Errors',
        icon: AlertTriangle,
        render: (v) => (v?.length > 0 ? `${v.length} warning(s)` : 'None'),
        color: (v) => (v?.length > 0 ? 'var(--accent-amber)' : 'var(--accent-green)'),
        bg: (v) => (v?.length > 0 ? 'var(--accent-amber-dim)' : 'var(--accent-green-dim)'),
        dotColor: (v) => (v?.length > 0 ? 'amber' : 'green'),
    },
];

export default function SystemHealth({ data }) {
    const [logsExpanded, setLogsExpanded] = useState(true);

    if (!data) return null;

    return (
        <section className="section" id="health">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                    <ShieldCheck size={18} />
                </div>
                <h2>System Health</h2>
            </div>

            <div className="grid-4" style={{ marginBottom: 'var(--space-lg)' }}>
                {healthCards.map(({ key, label, icon: Icon, render, color, bg, dotColor }) => {
                    const val = data[key];
                    return (
                        <div className="card kpi-card" key={key}>
                            <div className="kpi-icon" style={{ background: bg(val, data), color: color(val, data) }}>
                                <Icon size={18} />
                            </div>
                            <span className="kpi-label">{label}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <span className={`status-dot ${dotColor(val, data)}`} />
                                <span style={{
                                    fontSize: '1.1rem', fontWeight: 700,
                                    color: color(val, data),
                                }}>
                                    {render(val, data)}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Expandable quick log */}
            <div className="card-flat">
                <button
                    onClick={() => setLogsExpanded((p) => !p)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem',
                        fontWeight: 600, padding: 0, cursor: 'pointer',
                    }}
                >
                    <span>Status Messages ({data.status_messages?.length || 0})</span>
                    {logsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {logsExpanded && data.status_messages?.length > 0 && (
                    <div className="log-list" style={{ marginTop: 'var(--space-md)' }}>
                        {data.status_messages.map((msg, i) => (
                            <div className="log-item" key={i}>
                                <span className={`log-severity ${msg.severity}`}>
                                    {msg.severity}
                                </span>
                                <span style={{ flex: 1 }}>{msg.text}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', flexShrink: 0 }}>
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* NEW: Sortable Log Timeline (PRD v2) */}
            <LogTimeline messages={data.status_messages} />
        </section>
    );
}
