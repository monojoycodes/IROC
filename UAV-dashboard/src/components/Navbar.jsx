import { RefreshCw } from 'lucide-react';
import BackendHealth from './BackendHealth';

export default function Navbar({ missionStatus, onRefresh, loading, missions, selectedMission, onMissionSelect }) {
    return (
        <header className="navbar">
            <div className="navbar-left">
                <h1>Post-Flight Dashboard</h1>
                {missionStatus && (() => {
                    const isOk = missionStatus.toLowerCase() === 'completed';
                    return (
                        <span className={`badge ${isOk ? 'badge-success' : 'badge-danger'}`}>
                            <span className={`status-dot ${isOk ? 'green' : 'red'}`} />
                            {missionStatus}
                        </span>
                    );
                })()}
                {/* Mission Selector Dropdown */}
                {missions && missions.length > 0 && (
                    <select
                        className="mission-selector"
                        value={selectedMission || ''}
                        onChange={(e) => onMissionSelect?.(e.target.value)}
                    >
                        {missions.map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                    </select>
                )}
            </div>
            <div className="navbar-right">
                <BackendHealth />
                <button
                    className="btn btn-ghost"
                    onClick={onRefresh}
                    disabled={loading}
                    title="Reload mission data"
                >
                    <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                    <span>Refresh</span>
                </button>
            </div>
        </header>
    );
}
