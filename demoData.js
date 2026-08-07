// Used only when Supabase env vars aren't set yet, so a fresh deploy still
// shows a working dashboard. Once Supabase is connected, live data replaces this.
const now = Date.now();
const ago = (min) => new Date(now - min * 60000).toISOString();

export const DEMO_BINS = [
  { id: "bin_01", name: "Jay St Entrance",  lat: 40.6939, lng: -73.9868, depth_cm: 30, threshold: 85, pct: 92, dist_cm: 2.4,  level: "FULL",   last_seen: ago(4) },
  { id: "bin_02", name: "MetroTech Commons", lat: 40.6947, lng: -73.9856, depth_cm: 30, threshold: 85, pct: 71, dist_cm: 8.7,  level: "MEDIUM", last_seen: ago(9) },
  { id: "bin_03", name: "Rogers Hall",       lat: 40.6935, lng: -73.9849, depth_cm: 30, threshold: 85, pct: 33, dist_cm: 20.1, level: "LOW",    last_seen: ago(6) },
  { id: "bin_04", name: "Dibner Library",    lat: 40.6952, lng: -73.9862, depth_cm: 30, threshold: 85, pct: 88, dist_cm: 3.6,  level: "FULL",   last_seen: ago(2) },
  { id: "bin_05", name: "Willoughby Plaza",  lat: 40.6928, lng: -73.9871, depth_cm: 30, threshold: 85, pct: 18, dist_cm: 24.6, level: "LOW",    last_seen: ago(13) },
  { id: "bin_06", name: "Bridge St Lot",     lat: 40.696,  lng: -73.9845, depth_cm: 30, threshold: 85, pct: 64, dist_cm: 10.8, level: "MEDIUM", last_seen: ago(7) },
];
