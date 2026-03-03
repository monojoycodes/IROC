import { useState, useEffect } from 'react';
import { fetchHealth } from '../services/health';
import { Wifi, WifiOff, Clock, HardDrive, Timer } from 'lucide-react';

export default function BackendHealth() {
    const [health, setHealth] = useState(null);
    const [reachable, setReachable] = useState(null); // null = unknown, true/false

    useEffect(() => {
        let mounted = true;
        async function check() {
            const result = await fetchHealth();
            if (!mounted) return;
            if (result) {
                setHealth(result);
                setReachable(true);
            } else {
                setHealth(null);
                setReachable(false);
            }
        }
        check();
        const interval = setInterval(check, 15000); // re-check every 15s
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    if (reachable === null) return null; // still checking

    return (
        <div className="backend-health">
            <div className="backend-health-indicator" title={reachable ? 'Backend connected' : 'Backend unreachable'}>
                {reachable ? (
                    <Wifi size={14} style={{ color: 'var(--accent-green)' }} />
                ) : (
                    <WifiOff size={14} style={{ color: 'var(--accent-red)' }} />
                )}
                <span className={`status-dot ${reachable ? 'green' : 'red'}`} />
            </div>

            {reachable && health && (
                <div className="backend-health-details">
                    {health.last_mission && (
                        <span title="Last mission timestamp">
                            <Clock size={11} /> {new Date(health.last_mission).toLocaleTimeString()}
                        </span>
                    )}
                    {health.log_size_mb != null && (
                        <span title="Log file size">
                            <HardDrive size={11} /> {health.log_size_mb} MB
                        </span>
                    )}
                    {health.parse_time_ms != null && (
                        <span title="Parse duration">
                            <Timer size={11} /> {health.parse_time_ms} ms
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
