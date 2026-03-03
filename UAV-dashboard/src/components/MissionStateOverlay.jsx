import { Loader2, AlertCircle, Wifi, WifiOff, Plane } from 'lucide-react';

const stateConfig = {
    idle: {
        icon: Plane,
        title: 'Waiting for Mission…',
        subtitle: 'No flight data available. Fly a mission and download the log to begin.',
        color: 'var(--text-muted)',
        showProgress: false,
    },
    downloading: {
        icon: Loader2,
        title: 'Downloading Flight Log…',
        subtitle: 'Receiving data from Pixhawk via MAVLink.',
        color: 'var(--accent-blue)',
        showProgress: true,
        spin: true,
    },
    parsing: {
        icon: Loader2,
        title: 'Parsing Flight Data…',
        subtitle: 'Extracting GPS, battery, health, and profile data from .BIN log.',
        color: 'var(--accent-cyan)',
        showProgress: false,
        spin: true,
    },
    error: {
        icon: AlertCircle,
        title: 'Mission Error',
        subtitle: 'Failed to process flight data.',
        color: 'var(--accent-red)',
        showProgress: false,
    },
};

export default function MissionStateOverlay({ missionState, onRetry }) {
    if (!missionState || missionState.state === 'ready') return null;

    const config = stateConfig[missionState.state] || stateConfig.error;
    const Icon = config.icon;
    const progress = Math.round((missionState.progress || 0) * 100);

    return (
        <div className="mission-overlay">
            <div className="mission-overlay-content">
                <div className="mission-overlay-icon" style={{ color: config.color }}>
                    <Icon size={48} className={config.spin ? 'spinning' : ''} />
                </div>

                <h2 style={{ color: config.color, fontSize: '1.3rem', marginTop: 'var(--space-md)' }}>
                    {config.title}
                </h2>

                <p style={{ color: 'var(--text-secondary)', maxWidth: 420, textAlign: 'center', lineHeight: 1.5 }}>
                    {missionState.message || config.subtitle}
                </p>

                {config.showProgress && (
                    <div className="mission-overlay-progress">
                        <div className="mission-overlay-progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {config.showProgress && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {progress}%
                    </span>
                )}

                {missionState.state === 'error' && onRetry && (
                    <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: 'var(--space-md)' }}>
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}
