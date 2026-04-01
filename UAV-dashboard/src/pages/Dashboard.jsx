import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMission, fetchMissionById, uploadBinLog } from '../services/api';
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
import InFlightView from '../components/InFlightView';

const API = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

function useLiveTelemetry() {
    const [live, setLive] = useState(null);
    useEffect(() => {
        let mounted = true;
        async function poll() {
            try {
                const res = await fetch(`${API}/api/live`);
                if (res.ok && mounted) setLive(await res.json());
            } catch {
                if (mounted) setLive(prev => prev ? { ...prev, connected: false } : null);
            }
        }
        poll();
        const id = setInterval(poll, 250);
        return () => { mounted = false; clearInterval(id); };
    }, []);
    return live;
}

export default function Dashboard() {
    const live = useLiveTelemetry();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
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

            // If backend is actively downloading/parsing, block UI
            if (state && state.state !== 'ready' && state.state !== 'idle') {
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

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            await uploadBinLog(file);
            // After successful upload, the backend takes over parsing and we'll see missionState updates
            loadMission();
        } catch (err) {
            setError(err.message);
            setUploading(false);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
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
    }, [data, live?.armed]);

    // ── In-Flight Mode ──
    if (live?.armed) {
        return (
            <div className="app-layout inflight-layout">
                <StatusBar live={live} mission={null} battery={null} />
                <main className="inflight-main">
                    <InFlightView live={live} />
                </main>
            </div>
        );
    }

    // ΓöÇΓöÇ Mission State Overlay (blocks dashboard if downloading/parsing) ΓöÇΓöÇ
    if (missionState && missionState.state !== 'ready' && missionState.state !== 'idle' && !loading && !error) {
        return (
            <div className="app-layout">
                <StatusBar live={live} mission={null} battery={null} />
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

    // ΓöÇΓöÇ Loading state ΓöÇΓöÇ
    if (loading) {
        return (
            <div className="app-layout">
                <StatusBar live={live} mission={null} battery={null} />
                <Sidebar activeSection="overview" onSectionClick={() => { }} />
                <Navbar missionStatus={null} onRefresh={() => { }} loading={true} />
                <main className="main-content">
                    <div className="spinner-container">
                        <div className="spinner" />
                        <p style={{ color: 'var(--text-muted)' }}>Loading mission dataΓÇª</p>
                    </div>
                </main>
            </div>
        );
    }

    // ΓöÇΓöÇ Error state ΓöÇΓöÇ
    if (error) {
        return (
            <div className="app-layout">
                <StatusBar live={live} mission={null} battery={null} />
                <Sidebar activeSection="overview" onSectionClick={() => { }} />
                <Navbar
                    missionStatus={null}
                    onRefresh={() => loadMission()}
                    loading={loading || uploading}
                    missions={missions}
                    selectedMission={selectedMission}
                    onMissionSelect={handleMissionSelect}
                />
                <main className="main-content">
                    <div className="error-container">
                        <h2>{uploading ? 'Uploading Log...' : 'Mission Data Unavailable'}</h2>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: 480 }}>{error}</p>
                        <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                            <button className="btn btn-primary" onClick={() => loadMission()} disabled={uploading}>
                                Retry Connection
                            </button>
                            <input 
                                type="file" 
                                accept=".bin" 
                                style={{ display: 'none' }} 
                                ref={fileInputRef}
                                onChange={handleFileUpload} 
                            />
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                Upload .BIN Log
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ΓöÇΓöÇ Dashboard ΓöÇΓöÇ
    return (
        <div className="app-layout">
            <StatusBar live={live} mission={data.mission} battery={data.battery} />
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
                <PayloadGallery />
                <BatteryPanel data={data.battery} />
                <FlightMap data={data.gps} />
                <FlightProfile data={data.profile} />
                <SystemHealth data={data.health} />
                <Downloads />
            </main>
        </div>
    );
}
