import { useState, useEffect, useCallback } from 'react';
import { Image, Upload, Trash2, X, RefreshCw } from 'lucide-react';
import { fetchSeeds, uploadSeeds, deleteSeed, clearAllSeeds } from '../services/ascend';

export default function SeedManager() {
    const [seeds, setSeeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [preview, setPreview] = useState(null);

    const loadSeeds = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchSeeds();
            setSeeds(data.seeds || []);
        } catch {
            setSeeds([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSeeds(); }, [loadSeeds]);

    const handleFiles = async (files) => {
        if (!files.length) return;
        setUploading(true);
        try {
            await uploadSeeds(Array.from(files));
            await loadSeeds();
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDelete = async (filename) => {
        await deleteSeed(filename);
        loadSeeds();
        if (preview?.filename === filename) setPreview(null);
    };

    const handleClearAll = async () => {
        await clearAllSeeds();
        setSeeds([]);
        setPreview(null);
    };

    return (
        <section className="section" id="seeds">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' }}>
                    <Image size={18} />
                </div>
                <h2>Seed Images</h2>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {seeds.length} / 5 seeds
                </span>
            </div>

            {/* Upload zone */}
            <div
                className="card-flat"
                style={{
                    border: dragOver ? '2px dashed #a855f7' : '2px dashed var(--border)',
                    background: dragOver ? 'rgba(168, 85, 247, 0.05)' : 'transparent',
                    textAlign: 'center',
                    padding: 'var(--space-lg)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: 'var(--space-md)',
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('seed-file-input').click()}
            >
                <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    {uploading ? 'Uploading…' : 'Drop seed images here or click to browse'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: '4px 0 0', opacity: 0.6 }}>
                    3-5 reference images of feature types (rock, oxide, ice)
                </p>
                <input
                    id="seed-file-input"
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFiles(e.target.files)}
                />
            </div>

            {/* Seed grid */}
            {seeds.length === 0 ? (
                <div className="card-flat" style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                    No seed images uploaded yet. Upload reference images before launch.
                </div>
            ) : (
                <>
                    <div className="grid-3">
                        {seeds.map((seed, i) => (
                            <div
                                className="card"
                                key={seed.filename}
                                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                                onClick={() => setPreview(seed)}
                            >
                                <img
                                    src={seed.url}
                                    alt={seed.filename}
                                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                                    loading="lazy"
                                />
                                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {seed.filename}
                                        </span>
                                        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                            {seed.size_kb} KB
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(seed.filename); }}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)', border: 'none',
                                            borderRadius: 6, padding: '6px', cursor: 'pointer',
                                            color: '#ef4444', display: 'flex',
                                        }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-sm)' }}>
                        <button className="btn btn-ghost" onClick={loadSeeds} style={{ fontSize: '0.75rem' }}>
                            <RefreshCw size={12} /> Refresh
                        </button>
                        <button className="btn btn-ghost" onClick={handleClearAll} style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                            <Trash2 size={12} /> Clear All
                        </button>
                    </div>
                </>
            )}

            {/* Preview modal */}
            {preview && (
                <div className="modal-overlay" onClick={() => setPreview(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0, overflow: 'hidden' }}>
                        <div style={{ position: 'relative' }}>
                            <img src={preview.url} alt={preview.filename} style={{ width: '100%', height: 'auto' }} />
                            <button
                                onClick={() => setPreview(null)}
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
                        <div style={{ padding: '14px 18px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{preview.filename}</span>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                {preview.size_kb} KB · Uploaded {new Date(preview.uploaded_at).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
