export default function StatusBar({ live, mission, battery }) {
    const isArmed = live?.armed === true;
    const isCompleted = mission?.status === 'Completed';
    const status = isArmed ? 'IN FLIGHT' : (isCompleted ? 'DOCKED' : 'READY');
    
    // Time logic - use current time if in flight, else static or current time
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    }) + ' ' + now.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }) + ' HRS';

    // Battery logic
    const battPct = isArmed && live?.battery_percent != null
        ? live.battery_percent
        : battery?.end_percent ?? '--';
    const charging = !isArmed && isCompleted;

    return (
        <div className="status-bar">
            <div className="status-bar-left">
                <span className="status-bar-badge">
                    <span className={`status-bar-dot ${status === 'DOCKED' ? 'green' : 'amber'}`} />
                    STATUS: {status}
                </span>
                {isArmed && live?.flight_mode && (
                    <span className="inflight-status-mode">{live.flight_mode}</span>
                )}
                <span className="status-bar-meta">
                    {isArmed ? `live as of ${timestamp}` : `received data as of ${timestamp}`}
                </span>
            </div>
            <div className="status-bar-right">
                Battery: {battPct}% {charging ? '(Charging)' : ''}
            </div>
        </div>
    );
}
