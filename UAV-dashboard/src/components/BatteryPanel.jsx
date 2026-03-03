import { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Battery as BatteryIcon, Zap, TrendingDown, Activity } from 'lucide-react';

const stats = [
    { key: 'start_percent', label: 'Start Charge', icon: BatteryIcon, color: 'var(--accent-green)', bg: 'var(--accent-green-dim)', unit: '%' },
    { key: 'end_percent', label: 'End Charge', icon: TrendingDown, color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', unit: '%' },
    { key: 'min_voltage', label: 'Min Voltage', icon: Activity, color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', unit: 'V' },
    { key: 'peak_current', label: 'Peak Current', icon: Zap, color: 'var(--accent-cyan)', bg: 'rgba(34, 211, 238, 0.12)', unit: 'A' },
];

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
        return (
            <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.8rem',
            }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                <p style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    {payload[0].value.toFixed(2)} V
                </p>
            </div>
        );
    }
    return null;
};

export default function BatteryPanel({ data }) {
    if (!data) return null;

    // Memoize chart data to prevent re-computation on every render
    const chartData = useMemo(() =>
        data.voltage_curve.map((p) => ({
            time: formatTime(p.timestamp),
            voltage: p.voltage,
        })),
        [data.voltage_curve]
    );

    return (
        <section className="section" id="battery">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                    <BatteryIcon size={18} />
                </div>
                <h2>Battery Report</h2>
            </div>

            <div className="grid-4" style={{ marginBottom: 'var(--space-lg)' }}>
                {stats.map(({ key, label, icon: Icon, color, bg, unit }) => (
                    <div className="card kpi-card" key={key}>
                        <div className="kpi-icon" style={{ background: bg, color }}>
                            <Icon size={18} />
                        </div>
                        <span className="kpi-label">{label}</span>
                        <span className="kpi-value">
                            {data[key]}<span className="kpi-unit">{unit}</span>
                        </span>
                    </div>
                ))}
            </div>

            <div className="card-flat" style={{ padding: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Voltage vs Time
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit=" V" />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="voltage"
                            stroke="var(--accent-cyan)"
                            strokeWidth={2}
                            fill="url(#voltGrad)"
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--accent-cyan)' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
