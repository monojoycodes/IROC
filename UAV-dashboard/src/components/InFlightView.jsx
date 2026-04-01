import GyroCard from './GyroCard';
import LiveMetricsRow from './LiveMetricsRow';

export default function InFlightView({ live }) {
    return (
        <div className="inflight-view">
            <LiveMetricsRow live={live} />
            <div className="inflight-grid-2">
                <GyroCard
                    roll={live?.roll ?? 0}
                    pitch={live?.pitch ?? 0}
                    yaw={live?.yaw ?? 0}
                />
            </div>
        </div>
    );
}
