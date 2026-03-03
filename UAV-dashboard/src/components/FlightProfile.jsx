import { useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ArrowUpFromDot } from 'lucide-react';

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ChartTooltip = ({ active, payload, label, unit }) => {
    if (active && payload?.length) {
        return (
            <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.8rem',
            }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                <p style={{ color: payload[0].stroke, fontWeight: 600 }}>
                    {payload[0].value} {unit}
                </p>
            </div>
        );
    }
    return null;
};

export default function FlightProfile({ data }) {
    if (!data) return null;

    // Memoize datasets to avoid re-computation
    const altData = useMemo(() =>
        data.altitude.map((p) => ({
            time: formatTime(p.timestamp),
            altitude: p.altitude,
        })),
        [data.altitude]
    );

    const speedData = useMemo(() =>
        data.speed.map((p) => ({
            time: formatTime(p.timestamp),
            speed: p.speed,
        })),
        [data.speed]
    );

    return (
        <section className="section" id="profile">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
                    <TrendingUp size={18} />
                </div>
                <h2>Flight Profile</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {/* Altitude Chart */}
                <div className="card-flat" style={{ padding: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ArrowUpFromDot size={14} /> Altitude vs Time
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={altData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} unit=" m" />
                            <Tooltip content={<ChartTooltip unit="m" />} />
                            <Line
                                type="monotone"
                                dataKey="altitude"
                                stroke="var(--accent-purple)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 3, fill: 'var(--accent-purple)' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Speed Chart */}
                <div className="card-flat" style={{ padding: 'var(--space-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={14} /> Ground Speed vs Time
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={speedData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} unit=" m/s" />
                            <Tooltip content={<ChartTooltip unit="m/s" />} />
                            <Line
                                type="monotone"
                                dataKey="speed"
                                stroke="var(--accent-amber)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 3, fill: 'var(--accent-amber)' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
}
