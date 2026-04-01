import { Battery, BatteryLow, BatteryMedium, BatteryFull, BatteryWarning,
    ArrowUp, Gauge, Compass, TrendingUp, Zap } from 'lucide-react';

export default function LiveMetricsRow({ live }) {
    if (!live) return null;

    const { battery_percent, battery_voltage, battery_current,
        altitude, speed, heading, climb_rate, flight_mode, armed } = live;

    const battPct = battery_percent ?? 0;
    const battColor = battPct <= 10 ? 'var(--accent-red)' : battPct <= 30 ? '#f59e0b' : 'var(--accent-green)';

    return (
        <div className="inflight-metrics-row">
            {/* Flight Mode */}
            <div className="card inflight-metric-card inflight-metric-wide">
                <div className="inflight-metric-header">
                    <span className="inflight-icon-box" style={{ background: armed ? 'rgba(249,115,22,0.15)' : 'rgba(74,222,128,0.15)' }}>
                        <Zap size={18} style={{ color: armed ? '#f97316' : 'var(--accent-green)' }} />
                    </span>
                    <span className="inflight-metric-label">FLIGHT MODE</span>
                </div>
                <div className="inflight-metric-value" style={{ color: armed ? '#f97316' : 'var(--accent-green)' }}>
                    {flight_mode || 'UNKNOWN'}
                </div>
                <div className="inflight-metric-sub">{armed ? 'ARMED' : 'DISARMED'}</div>
            </div>

            {/* Battery */}
            <div className="card inflight-metric-card">
                <div className="inflight-metric-header">
                    <span className="inflight-icon-box" style={{ background: `${battColor}20` }}>
                        {battPct <= 10 ? <BatteryWarning size={18} style={{ color: battColor }} /> :
                            battPct <= 30 ? <BatteryLow size={18} style={{ color: battColor }} /> :
                                battPct <= 60 ? <BatteryMedium size={18} style={{ color: battColor }} /> :
                                    <BatteryFull size={18} style={{ color: battColor }} />}
                    </span>
                    <span className="inflight-metric-label">BATTERY</span>
                </div>
                <div className="inflight-metric-value" style={{ color: battColor }}>
                    {battery_percent != null ? `${battery_percent}%` : '—'}
                </div>
                <div className="inflight-metric-sub">
                    {battery_voltage != null ? `${battery_voltage}V` : ''}
                    {battery_current != null ? ` · ${battery_current}A` : ''}
                </div>
                {/* Battery bar */}
                <div className="inflight-battery-bar">
                    <div className="inflight-battery-fill" style={{
                        width: `${Math.min(100, battPct)}%`,
                        background: battColor,
                    }} />
                </div>
            </div>

            {/* Altitude */}
            <div className="card inflight-metric-card">
                <div className="inflight-metric-header">
                    <span className="inflight-icon-box" style={{ background: 'rgba(56,189,248,0.15)' }}>
                        <ArrowUp size={18} style={{ color: 'var(--accent-cyan)' }} />
                    </span>
                    <span className="inflight-metric-label">ALTITUDE</span>
                </div>
                <div className="inflight-metric-value" style={{ color: 'var(--accent-cyan)' }}>
                    {altitude != null ? `${altitude.toFixed(1)}` : '—'}
                    <span className="inflight-metric-unit">m</span>
                </div>
                <div className="inflight-metric-sub">
                    Climb: {climb_rate != null ? `${climb_rate > 0 ? '+' : ''}${climb_rate.toFixed(1)} m/s` : '—'}
                </div>
            </div>

            {/* Speed */}
            <div className="card inflight-metric-card">
                <div className="inflight-metric-header">
                    <span className="inflight-icon-box" style={{ background: 'rgba(168,85,247,0.15)' }}>
                        <Gauge size={18} style={{ color: 'var(--accent-purple, #a78bfa)' }} />
                    </span>
                    <span className="inflight-metric-label">SPEED</span>
                </div>
                <div className="inflight-metric-value" style={{ color: 'var(--accent-purple, #a78bfa)' }}>
                    {speed != null ? `${speed.toFixed(1)}` : '—'}
                    <span className="inflight-metric-unit">m/s</span>
                </div>
                <div className="inflight-metric-sub">&nbsp;</div>
            </div>

            {/* Heading */}
            <div className="card inflight-metric-card">
                <div className="inflight-metric-header">
                    <span className="inflight-icon-box" style={{ background: 'rgba(251,191,36,0.15)' }}>
                        <Compass size={18} style={{ color: '#fbbf24' }} />
                    </span>
                    <span className="inflight-metric-label">HEADING</span>
                </div>
                <div className="inflight-metric-value" style={{ color: '#fbbf24' }}>
                    {heading != null ? `${heading}°` : '—'}
                </div>
                <div className="inflight-metric-sub">{headingToCardinal(heading)}</div>
            </div>
        </div>
    );
}

function headingToCardinal(deg) {
    if (deg == null) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}
