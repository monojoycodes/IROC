import { useState } from 'react';
import { Camera, MapPin, Clock, X } from 'lucide-react';

// Placeholder image generator (colored SVG data-uri)
function placeholderImg(index) {
    const colors = ['#6366f1', '#14b8a6', '#f59e0b'];
    const color = colors[index % colors.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect fill="${color}" width="400" height="300" rx="8"/>
    <text x="200" y="140" text-anchor="middle" fill="#fff" font-size="24" font-family="Inter,sans-serif" font-weight="600">Payload Image</text>
    <text x="200" y="175" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="16" font-family="Inter,sans-serif">#${String(index + 1).padStart(3, '0')}</text>
  </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export default function PayloadGallery({ data }) {
    const [selected, setSelected] = useState(null);

    if (!data?.images?.length) {
        return (
            <section className="section" id="payload">
                <div className="section-header">
                    <div className="section-icon" style={{ background: 'rgba(34, 211, 238, 0.12)', color: 'var(--accent-cyan)' }}>
                        <Camera size={18} />
                    </div>
                    <h2>Payload / Images</h2>
                </div>
                <div className="card-flat" style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-muted)' }}>
                    No payload images captured during this mission.
                </div>
            </section>
        );
    }

    return (
        <section className="section" id="payload">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'rgba(34, 211, 238, 0.12)', color: 'var(--accent-cyan)' }}>
                    <Camera size={18} />
                </div>
                <h2>Payload / Images</h2>
            </div>

            <div className="grid-3">
                {data.images.map((img, i) => (
                    <div
                        className="card"
                        key={i}
                        onClick={() => setSelected(img)}
                        style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}
                    >
                        <img
                            src={img.file || placeholderImg(i)}
                            alt={`Payload ${i + 1}`}
                            style={{ width: '100%', height: 180, objectFit: 'cover' }}
                            loading="lazy"
                            onError={(e) => { e.target.src = placeholderImg(i); }}
                        />
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                IMG_{String(i + 1).padStart(3, '0')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={11} /> {new Date(img.timestamp).toLocaleTimeString()}
                                </span>
                                {img.lat && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={11} /> {img.lat.toFixed(3)}, {img.lon.toFixed(3)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {selected && (
                <div className="modal-overlay" onClick={() => setSelected(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0, overflow: 'hidden' }}>
                        <div style={{ position: 'relative' }}>
                            <img
                                src={selected.file || placeholderImg(data.images.indexOf(selected))}
                                alt="Preview"
                                style={{ width: '100%', height: 'auto' }}
                                onError={(e) => { e.target.src = placeholderImg(data.images.indexOf(selected)); }}
                            />
                            <button
                                onClick={() => setSelected(null)}
                                style={{
                                    position: 'absolute', top: 12, right: 12, width: 32, height: 32,
                                    borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                {selected.file}
                            </span>
                            <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={12} /> {new Date(selected.timestamp).toLocaleString()}
                                </span>
                                {selected.lat && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={12} /> {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
