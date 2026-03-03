import { useState, useEffect, useCallback } from 'react';
import { fetchMission, fetchMissionById } from '../services/api';
import { fetchMissionState, fetchMissionList } from '../services/missions';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import StatusBar from '../components/StatusBar';
import MissionStateOverlay from '../components/MissionStateOverlay';
import MissionSummary from '../components/MissionSummary';
import BatteryPanel from '../components/BatteryPanel';
import FlightMap from '../components/FlightMap';
import FlightProfile from '../components/FlightProfile';
import SystemHealth from '../components/SystemHealth';
import PayloadGallery from '../components/PayloadGallery';
import Downloads from '../components/Downloads';
import SeedManager from '../components/SeedManager';
import SortiePanel from '../components/SortiePanel';
import DetectionGallery from '../components/DetectionGallery';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState('overview');

    // PRD v2: Mission state (idle/downloading/parsing/ready/error)
    const [missionState, setMissionState] = useState(null);
    // PRD v2: Mission selector
    const [missions, setMissions] = useState([]);
    const [selectedMission, setSelectedMission] = useState(null);

    const loadMission = useCallback(async (missionId) => {
        setLoading(true);
        setError(null);
        try {
            // Check mission pipeline state first
            const state = await fetchMissionState();
            setMissionState(state);

            // If backend reports a non-ready state, don't try to load data
            if (state && state.state !== 'ready') {
                setLoading(false);
                return;
            }

            // Load mission data
            const mission = missionId
                ? await fetchMissionById(missionId)
                : await fetchMission();
            setData(mission);

            // Load mission list for selector
            const list = await fetchMissionList();
            setMissions(list);
        } catch (err) {
            setError(err.message || 'Failed to load mission data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadMission();
    }, [loadMission]);

    // Poll mission state while not ready (downloading/parsing)
    useEffect(() => {
        if (!missionState || missionState.state === 'ready' || missionState.state === 'error') return;
        const interval = setInterval(async () => {
            const state = await fetchMissionState();
            setMissionState(state);
            if (state?.state === 'ready') {
                clearInterval(interval);
                loadMission(); // auto-load when ready
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [missionState, loadMission]);

    // Handle mission selector change
    const handleMissionSelect = (id) => {
        setSelectedMission(id);
        loadMission(id);
    };

    // Scroll to section
    const handleSectionClick = (id) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Track active section on scroll
    useEffect(() => {
        const sectionIds = ['overview', 'seeds', 'sorties', 'detections', 'payload', 'battery', 'map', 'profile', 'health', 'downloads'];
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
        );

        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [data]);

    // ── Mission State Overlay (blocks dashboard until ready) ──
    if (missionState && missionState.state !== 'ready' && !loading && !error) {
        return (
            <div className="app-layout">
                <StatusBar mission={null} battery={null} />
                <Sidebar activeSection="overview" onSectionClick={() => { }} />
                <Navbar missionStatus={null} onRefresh={() => loadMission()} loading={false} />
                <main className="main-content">
                    <MissionStateOverlay
                        missionState={missionState}
                        onRetry={() => loadMission()}
                    />
                </main>
            </div>
        );
    }

    // ── Loading state ──
    if (loading) {
        return (
            <div className="app-layout">
                <StatusBar mission={null} battery={null} />
                <Sidebar activeSection="overview" onSectionClick={() => { }} />
                <Navbar missionStatus={null} onRefresh={() => { }} loading={true} />
                <main className="main-content">
                    <div className="spinner-container">
                        <div className="spinner" />
                        <p style={{ color: 'var(--text-muted)' }}>Loading mission data…</p>
                    </div>
                </main>
            </div>
        );
    }

    // ── Error state ──
    if (error) {
        return (
            <div className="app-layout">
                <StatusBar mission={null} battery={null} />
                <Sidebar activeSection="overview" onSectionClick={() => { }} />
                <Navbar missionStatus={null} onRefresh={() => loadMission()} loading={false} />
                <main className="main-content">
                    <div className="error-container">
                        <h2>Mission Data Unavailable</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: 480 }}>{error}</p>
                        <button className="btn btn-primary" onClick={() => loadMission()}>Retry</button>
                    </div>
                </main>
            </div>
        );
    }

    // ── Dashboard ──
    return (
        <div className="app-layout">
            <StatusBar mission={data.mission} battery={data.battery} />
            <Sidebar activeSection={activeSection} onSectionClick={handleSectionClick} />
            <Navbar
                missionStatus={data.mission?.status}
                onRefresh={() => loadMission()}
                loading={loading}
                missions={missions}
                selectedMission={selectedMission}
                onMissionSelect={handleMissionSelect}
            />
            <main className="main-content">
                <MissionSummary data={data.mission} />
                <SeedManager />
                <SortiePanel />
                <DetectionGallery />
                <PayloadGallery data={data.payload} />
                <BatteryPanel data={data.battery} />
                <FlightMap data={data.gps} />
                <FlightProfile data={data.profile} />
                <SystemHealth data={data.health} />
                <Downloads />
            </main>
        </div>
    );
}
