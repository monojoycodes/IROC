import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { Map as MapIcon } from 'lucide-react';

// ── Performance: Downsample large GPS arrays ──────────────
function downsample(arr, maxPoints = 5000) {
    if (arr.length <= maxPoints) return arr;
    const step = Math.ceil(arr.length / maxPoints);
    const result = [];
    for (let i = 0; i < arr.length; i += step) {
        result.push(arr[i]);
    }
    // Always include the last point
    if (result[result.length - 1] !== arr[arr.length - 1]) {
        result.push(arr[arr.length - 1]);
    }
    return result;
}

// Auto-fit bounds helper
function FitBounds({ positions }) {
    const map = useMap();
    useMemo(() => {
        if (positions.length > 0) {
            map.fitBounds(positions, { padding: [40, 40] });
        }
    }, [map, positions]);
    return null;
}

export default function FlightMap({ data }) {
    if (!data) return null;

    // Memoize + downsample positions for performance (handles 50k+ points)
    const positions = useMemo(() => {
        const raw = data.track.map((p) => [p.lat, p.lon]);
        return downsample(raw, 5000);
    }, [data.track]);

    const takeoff = data.takeoff ? [data.takeoff.lat, data.takeoff.lon] : positions[0];
    const landing = data.landing ? [data.landing.lat, data.landing.lon] : positions[positions.length - 1];

    const pointCount = data.track.length;
    const displayCount = positions.length;

    return (
        <section className="section" id="map">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' }}>
                    <MapIcon size={18} />
                </div>
                <h2>Flight Path Map</h2>
                {pointCount > displayCount && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        Showing {displayCount.toLocaleString()} of {pointCount.toLocaleString()} GPS points
                    </span>
                )}
            </div>

            <div className="card-flat" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
                <MapContainer
                    center={positions[0]}
                    zoom={15}
                    style={{ height: 420, width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <FitBounds positions={positions} />
                    <Polyline
                        positions={positions}
                        pathOptions={{ color: '#a855f7', weight: 3, opacity: 0.85, lineCap: 'round' }}
                    />
                    <CircleMarker
                        center={takeoff}
                        radius={8}
                        pathOptions={{ fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1 }}
                    >
                        <Popup>
                            <strong>Takeoff</strong><br />
                            {data.takeoff?.timestamp && new Date(data.takeoff.timestamp).toLocaleTimeString()}
                        </Popup>
                    </CircleMarker>
                    <CircleMarker
                        center={landing}
                        radius={8}
                        pathOptions={{ fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }}
                    >
                        <Popup>
                            <strong>Landing</strong><br />
                            {data.landing?.timestamp && new Date(data.landing.timestamp).toLocaleTimeString()}
                        </Popup>
                    </CircleMarker>
                </MapContainer>
            </div>
        </section>
    );
}
