import { useState, useMemo } from 'react';
import { List, ArrowUpDown } from 'lucide-react';

export default function LogTimeline({ messages }) {
    const [sortBy, setSortBy] = useState('time'); // 'time' | 'severity'

    const severityOrder = { error: 0, warn: 1, info: 2 };

    const sorted = useMemo(() => {
        if (!messages?.length) return [];
        const arr = [...messages];
        if (sortBy === 'severity') {
            arr.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
        }
        // 'time' = original order (already chronological)
        return arr;
    }, [messages, sortBy]);

    if (!messages?.length) return null;

    return (
        <div className="card-flat" style={{ marginTop: 'var(--space-lg)' }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 'var(--space-md)',
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <List size={14} /> Log Timeline ({messages.length})
                </span>
                <button
                    className="btn btn-ghost"
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setSortBy((s) => s === 'time' ? 'severity' : 'time')}
                    title={`Sort by ${sortBy === 'time' ? 'severity' : 'time'}`}
                >
                    <ArrowUpDown size={12} />
                    {sortBy === 'time' ? 'By Time' : 'By Severity'}
                </button>
            </div>

            <div className="log-timeline">
                {sorted.map((msg, i) => (
                    <div className="log-timeline-row" key={i}>
                        <span className="log-timeline-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`log-severity ${msg.severity}`}>
                            {msg.severity}
                        </span>
                        <span className="log-timeline-text">
                            {msg.text}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
