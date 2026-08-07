// Where the collection truck starts and returns. Change to your real yard/depot.
export const DEPOT = {
  name: "Collection Depot",
  lat: 40.697,
  lng: -73.988,
};

// The map centers here on load (roughly the middle of your bin network).
export const MAP_CENTER = { lat: 40.6944, lng: -73.9862 };
export const MAP_ZOOM = 16;

// How often the dashboard re-pulls status as a safety net (ms).
// Live updates arrive instantly over Supabase realtime; this is just a backstop.
export const REFRESH_MS = 30000;

// "Filling" warning band. "Collect" is driven per-bin by each bin's own
// threshold column, so different bins can trigger at different fill levels.
export const FILLING_PCT = 60;

// Assumed truck fuel + labor cost per collection stop, used for the
// "estimated savings" tile. Rough, editable.
export const COST_PER_STOP_USD = 4.5;
