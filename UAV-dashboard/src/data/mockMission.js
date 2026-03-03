// ═══════════════════════════════════════════════════════════
// Mock Mission Data — Realistic UAV post-flight dataset
// ═══════════════════════════════════════════════════════════

// Helper: generate time-series data
const baseTime = new Date('2026-02-25T10:30:00Z').getTime();
const seconds = (s) => baseTime + s * 1000;
const fmt = (ms) => new Date(ms).toISOString();

// Generate GPS track (circular-ish flight pattern)
function generateGPSTrack(numPoints = 200) {
  const centerLat = 28.6139; // Delhi area
  const centerLon = 77.2090;
  const track = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    const angle = t * Math.PI * 2 * 1.5; // 1.5 loops
    const radius = 0.003 + 0.001 * Math.sin(t * Math.PI * 4);
    track.push({
      lat: centerLat + radius * Math.cos(angle) + (Math.random() - 0.5) * 0.0002,
      lon: centerLon + radius * Math.sin(angle) + (Math.random() - 0.5) * 0.0002,
      timestamp: fmt(seconds(i * 3)),
    });
  }
  return track;
}

// Generate voltage curve
function generateVoltageCurve(numPoints = 120) {
  const curve = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    const voltage = 16.8 - t * 3.2 + Math.sin(t * 12) * 0.15 + (Math.random() - 0.5) * 0.1;
    curve.push({
      timestamp: fmt(seconds(i * 5)),
      voltage: Math.round(voltage * 100) / 100,
    });
  }
  return curve;
}

// Generate altitude profile
function generateAltitudeProfile(numPoints = 200) {
  const profile = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    let alt;
    if (t < 0.1) alt = t * 10 * 45;          // climb
    else if (t < 0.85) alt = 45 + Math.sin(t * 8) * 10 + (Math.random() - 0.5) * 3; // cruise
    else alt = 45 * (1 - (t - 0.85) / 0.15);  // descent
    profile.push({
      timestamp: fmt(seconds(i * 3)),
      altitude: Math.max(0, Math.round(alt * 10) / 10),
    });
  }
  return profile;
}

// Generate speed profile
function generateSpeedProfile(numPoints = 200) {
  const profile = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    let speed;
    if (t < 0.08) speed = t * 12.5 * 12;
    else if (t < 0.88) speed = 12 + Math.sin(t * 6) * 3 + (Math.random() - 0.5) * 1.5;
    else speed = 12 * (1 - (t - 0.88) / 0.12);
    profile.push({
      timestamp: fmt(seconds(i * 3)),
      speed: Math.max(0, Math.round(speed * 10) / 10),
    });
  }
  return profile;
}

const gpsTrack = generateGPSTrack();
const altitudeProfile = generateAltitudeProfile();
const speedProfile = generateSpeedProfile();

const mockMission = {
  mission: {
    status: 'completed',
    duration: '10m 00s',
    duration_seconds: 600,
    distance: 2847,           // meters
    max_altitude: 54.8,       // meters
    max_speed: 15.3,          // m/s
    takeoff_time: fmt(baseTime),
    landing_time: fmt(seconds(600)),
  },
  battery: {
    start_percent: 98,
    end_percent: 42,
    min_voltage: 13.62,
    peak_current: 28.4,
    voltage_curve: generateVoltageCurve(),
  },
  gps: {
    track: gpsTrack,
    takeoff: gpsTrack[0],
    landing: gpsTrack[gpsTrack.length - 1],
  },
  profile: {
    altitude: altitudeProfile,
    speed: speedProfile,
  },
  health: {
    failsafe: false,
    gps_satellites: 14,
    gps_fix: '3D Fix',
    ekf_ok: true,
    arming_warnings: [],
    status_messages: [
      { severity: 'info', text: 'PreArm: Good', timestamp: fmt(seconds(-15)) },
      { severity: 'info', text: 'GPS: 3D Fix (14 sats)', timestamp: fmt(seconds(-10)) },
      { severity: 'info', text: 'EKF2 IMU0 is using GPS', timestamp: fmt(seconds(-8)) },
      { severity: 'info', text: 'Armed with AUTO', timestamp: fmt(seconds(0)) },
      { severity: 'warn', text: 'Vibration compensation ON', timestamp: fmt(seconds(45)) },
      { severity: 'info', text: 'Reached waypoint #1', timestamp: fmt(seconds(90)) },
      { severity: 'info', text: 'Reached waypoint #2', timestamp: fmt(seconds(180)) },
      { severity: 'info', text: 'Reached waypoint #3', timestamp: fmt(seconds(310)) },
      { severity: 'info', text: 'Reached waypoint #4', timestamp: fmt(seconds(420)) },
      { severity: 'info', text: 'RTL initiated', timestamp: fmt(seconds(500)) },
      { severity: 'info', text: 'Landing detected', timestamp: fmt(seconds(595)) },
      { severity: 'info', text: 'Disarmed', timestamp: fmt(seconds(600)) },
    ],
  },
  payload: {
    images: [
      { file: '/payload/img_001.jpg', timestamp: fmt(seconds(120)), lat: 28.615, lon: 77.211 },
      { file: '/payload/img_002.jpg', timestamp: fmt(seconds(240)), lat: 28.617, lon: 77.208 },
      { file: '/payload/img_003.jpg', timestamp: fmt(seconds(360)), lat: 28.614, lon: 77.206 },
    ],
  },
};

export default mockMission;
