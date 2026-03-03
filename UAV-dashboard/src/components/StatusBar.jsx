export default function StatusBar({ mission, battery }) {
    const status = mission?.status === 'Completed' ? 'DOCKED' : 'IN FLIGHT';
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    }) + ' ' + now.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }) + ' HRS';

    const battPct = battery?.end_percent ?? '--';
    const charging = mission?.status === 'Completed';

    return (
        <div className="status-bar">
            <div className="status-bar-left">
                <span className="status-bar-badge">
                    <span className={`status-bar-dot ${status === 'DOCKED' ? 'green' : 'amber'}`} />
                    STATUS: {status}
                </span>
                <span className="status-bar-meta">
                    received data as of {timestamp}
                </span>
            </div>
            <div className="status-bar-right">
                Battery: {battPct}% {charging ? '(Charging)' : ''}
            </div>
        </div>
    );
}
