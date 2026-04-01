import { useRef, useEffect } from 'react';

export default function GyroCard({ roll = 0, pitch = 0, yaw = 0 }) {
    const droneRef = useRef(null);

    useEffect(() => {
        if (!droneRef.current) return;
        droneRef.current.style.transform =
            `rotateX(${-pitch}deg) rotateY(${yaw * 0.3}deg) rotateZ(${-roll}deg)`;
    }, [roll, pitch, yaw]);

    const rollColor  = Math.abs(roll)  > 30 ? 'var(--accent-red)' : 'var(--accent-cyan)';
    const pitchColor = Math.abs(pitch) > 30 ? 'var(--accent-red)' : 'var(--accent-green)';
    const yawColor   = 'var(--accent-purple)';

    return (
        <div className="card inflight-gyro-card">
            <div className="inflight-section-label">Gyroscope / Attitude</div>

            <div className="inflight-gyro-body">
                {/* ── Scene ── */}
                <div className="inflight-gyro-scene">
                    {/* horizon ring */}
                    <div className="inflight-gyro-ring" />

                    {/* 3-D drone */}
                    <div className="inflight-gyro-drone" ref={droneRef}>
                        {/* arms */}
                        <div className="ig-arm ig-arm-fl" />
                        <div className="ig-arm ig-arm-fr" />
                        <div className="ig-arm ig-arm-bl" />
                        <div className="ig-arm ig-arm-br" />
                        {/* motors */}
                        <div className="ig-motor ig-motor-fl" />
                        <div className="ig-motor ig-motor-fr" />
                        <div className="ig-motor ig-motor-bl" />
                        <div className="ig-motor ig-motor-br" />
                        {/* props */}
                        <div className="ig-prop ig-prop-fl" />
                        <div className="ig-prop ig-prop-fr" />
                        <div className="ig-prop ig-prop-bl" />
                        <div className="ig-prop ig-prop-br" />
                        {/* fuselage */}
                        <div className="ig-fuselage" />
                        {/* front indicator */}
                        <div className="ig-front" />
                    </div>
                </div>

                {/* ── Readouts ── */}
                <div className="inflight-gyro-readouts">
                    <div className="inflight-gyro-row">
                        <span className="inflight-gyro-label">ROLL</span>
                        <span className="inflight-gyro-val" style={{ color: rollColor }}>
                            {roll.toFixed(1)}°
                        </span>
                    </div>
                    <div className="inflight-gyro-row">
                        <span className="inflight-gyro-label">PITCH</span>
                        <span className="inflight-gyro-val" style={{ color: pitchColor }}>
                            {pitch.toFixed(1)}°
                        </span>
                    </div>
                    <div className="inflight-gyro-row">
                        <span className="inflight-gyro-label">YAW</span>
                        <span className="inflight-gyro-val" style={{ color: yawColor }}>
                            {yaw.toFixed(1)}°
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
