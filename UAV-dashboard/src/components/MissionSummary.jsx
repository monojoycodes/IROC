import {
    CheckCircle,
    Clock,
    Route,
    ArrowUpFromDot,
    Gauge,
    Sunrise,
    Sunset,
} from 'lucide-react';

const kpis = [
    { key: 'status', label: 'Mission Status', icon: CheckCircle, color: 'var(--accent-green)', bg: 'var(--accent-green-dim)', format: (v) => v },
    { key: 'duration', label: 'Flight Duration', icon: Clock, color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', format: (v) => v },
    { key: 'distance', label: 'Total Distance', icon: Route, color: 'var(--accent-cyan)', bg: 'rgba(34, 211, 238, 0.12)', format: (v) => `${(v / 1000).toFixed(2)}`, unit: 'km' },
    { key: 'max_altitude', label: 'Max Altitude', icon: ArrowUpFromDot, color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)', format: (v) => `${v}`, unit: 'm' },
    { key: 'max_speed', label: 'Max Speed', icon: Gauge, color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', format: (v) => `${v}`, unit: 'm/s' },
    { key: 'takeoff_time', label: 'Takeoff Time', icon: Sunrise, color: 'var(--accent-green)', bg: 'var(--accent-green-dim)', format: (v) => new Date(v).toLocaleTimeString() },
    { key: 'landing_time', label: 'Landing Time', icon: Sunset, color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', format: (v) => new Date(v).toLocaleTimeString() },
];

export default function MissionSummary({ data }) {
    if (!data) return null;
    return (
        <section className="section" id="overview">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
                    <CheckCircle size={18} />
                </div>
                <h2>Mission Overview</h2>
            </div>
            <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                {kpis.map(({ key, label, icon: Icon, color, bg, format, unit }) => {
                    const val = data[key];
                    if (val === undefined) return null;
                    return (
                        <div className="card kpi-card" key={key}>
                            <div className="kpi-icon" style={{ background: bg, color }}>
                                <Icon size={18} />
                            </div>
                            <span className="kpi-label">{label}</span>
                            <span className="kpi-value" style={{ color: key === 'status' ? (val === 'Completed' ? 'var(--accent-green)' : 'var(--accent-red)') : undefined }}>
                                {format(val)}
                                {unit && <span className="kpi-unit">{unit}</span>}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
