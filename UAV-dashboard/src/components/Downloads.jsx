import { useState, useEffect } from 'react';
import { Download as DownloadIcon, FileText, HardDrive } from 'lucide-react';
import { downloadUrls } from '../services/api';
import { fetchDownloadMeta } from '../services/missions';

export default function Downloads() {
    const [meta, setMeta] = useState(null);

    useEffect(() => {
        fetchDownloadMeta().then(setMeta);
    }, []);

    return (
        <section className="section" id="downloads">
            <div className="section-header">
                <div className="section-icon" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
                    <DownloadIcon size={18} />
                </div>
                <h2>Downloads</h2>
            </div>

            <div className="grid-2" style={{ maxWidth: 600 }}>
                <a
                    href={downloadUrls.rawLog}
                    className="card"
                    style={{
                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                        cursor: 'pointer',
                    }}
                    download
                >
                    <div className="kpi-icon" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
                        <HardDrive size={18} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            Raw Flight Log
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Download .BIN file{meta?.raw_log_mb != null ? ` (${meta.raw_log_mb} MB)` : ''}
                        </div>
                    </div>
                    <DownloadIcon size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                </a>

                <a
                    href={downloadUrls.processedJson}
                    className="card"
                    style={{
                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                        cursor: 'pointer',
                    }}
                    download
                >
                    <div className="kpi-icon" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
                        <FileText size={18} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            Processed JSON
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Download parsed data{meta?.json_mb != null ? ` (${meta.json_mb} MB)` : ''}
                        </div>
                    </div>
                    <DownloadIcon size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                </a>
            </div>
        </section>
    );
}
