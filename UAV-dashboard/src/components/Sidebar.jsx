import { useState } from 'react';
import {
    LayoutDashboard,
    Battery,
    Map,
    TrendingUp,
    ShieldCheck,
    Camera,
    Download,
    Plane,
    Image,
    Rocket,
    Crosshair,
} from 'lucide-react';

const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'seeds', label: 'Seeds', icon: Image },
    { id: 'sorties', label: 'Sorties', icon: Rocket },
    { id: 'detections', label: 'Detections', icon: Crosshair },
    { id: 'payload', label: 'Payload', icon: Camera },
    { id: 'battery', label: 'Battery', icon: Battery },
    { id: 'map', label: 'Flight Map', icon: Map },
    { id: 'profile', label: 'Flight Profile', icon: TrendingUp },
    { id: 'health', label: 'System Health', icon: ShieldCheck },
    { id: 'downloads', label: 'Downloads', icon: Download },
];

export default function Sidebar({ activeSection, onSectionClick }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">
                    <Plane size={18} color="#fff" />
                </div>
                <span>IROC UAV</span>
            </div>
            <nav className="sidebar-nav">
                {sections.map(({ id, label, icon: Icon }) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className={`sidebar-link ${activeSection === id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            onSectionClick(id);
                        }}
                    >
                        <Icon size={18} />
                        <span>{label}</span>
                    </a>
                ))}
            </nav>
        </aside>
    );
}
