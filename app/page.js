"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* ================= config ================= */
const DEPOT = { name: "Collection Depot", lat: 40.697, lng: -73.988 };
const MAP_CENTER = { lat: 40.6944, lng: -73.9862 };
const MAP_ZOOM = 16;
const REFRESH_MS = 30000;
const FILLING_PCT = 60;
const COST_PER_STOP_USD = 4.5;

/* ================= supabase ================= */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isConfigured = Boolean(SB_URL && SB_KEY);
const supabase = isConfigured ? createClient(SB_URL, SB_KEY) : null;

/* ================= demo fallback ================= */
const now = Date.now();
const ago = (min) => new Date(now - min * 60000).toISOString();
const DEMO_BINS = [
  { id: "bin_01", name: "Jay St Entrance",   lat: 40.6939, lng: -73.9868, depth_cm: 30, threshold: 85, pct: 92, dist_cm: 2.4,  level: "FULL",   last_seen: ago(4) },
  { id: "bin_02", name: "MetroTech Commons", lat: 40.6947, lng: -73.9856, depth_cm: 30, threshold: 85, pct: 71, dist_cm: 8.7,  level: "MEDIUM", last_seen: ago(9) },
  { id: "bin_03", name: "Rogers Hall",       lat: 40.6935, lng: -73.9849, depth_cm: 30, threshold: 85, pct: 33, dist_cm: 20.1, level: "LOW",    last_seen: ago(6) },
  { id: "bin_04", name: "Dibner Library",    lat: 40.6952, lng: -73.9862, depth_cm: 30, threshold: 85, pct: 88, dist_cm: 3.6,  level: "FULL",   last_seen: ago(2) },
  { id: "bin_05", name: "Willoughby Plaza",  lat: 40.6928, lng: -73.9871, depth_cm: 30, threshold: 85, pct: 18, dist_cm: 24.6, level: "LOW",    last_seen: ago(13) },
  { id: "bin_06", name: "Bridge St Lot",     lat: 40.696,  lng: -73.9845, depth_cm: 30, threshold: 85, pct: 64, dist_cm: 10.8, level: "MEDIUM", last_seen: ago(7) },
];

/* ================= route optimization ================= */
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function optimizeRoute(depot, stops) {
  const remaining = stops.slice();
  const ordered = [];
  let current = depot;
  let distanceKm = 0;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    distanceKm += bestDist;
    ordered.push(next);
    current = next;
  }
  if (ordered.length) distanceKm += haversineKm(current, depot);
  return { ordered, path: [depot, ...ordered, depot], distanceKm };
}

/* ================= status helpers ================= */
function statusFor(pct, threshold = 85) {
  if (pct == null || Number.isNaN(pct) || pct < 0)
    return { code: "offline", label: "No signal" };
  if (pct >= threshold) return { code: "collect", label: "Collect now" };
  if (pct >= FILLING_PCT) return { code: "filling", label: "Filling" };
  return { code: "ok", label: "OK" };
}
const STATUS_COLOR = {
  collect: "var(--collect)",
  filling: "var(--filling)",
  ok: "var(--ok)",
  offline: "var(--muted)",
};
function clampPct(pct) {
  if (pct == null || Number.isNaN(pct) || pct < 0) return 0;
  return Math.max(0, Math.min(100, pct));
}
function timeAgo(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ================= small pieces ================= */
function BrandGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="9" width="14" height="12" rx="2" fill="#16211f" stroke="#2dd4bf" strokeWidth="1.6" />
      <rect x="5" y="15" width="14" height="6" fill="#2dd4bf" opacity="0.85" />
      <path d="M8 6.5h8" stroke="#2dd4bf" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 2.5a3.4 3.4 0 0 1 3.4 3.4M12 4.6a1.3 1.3 0 0 1 1.3 1.3" stroke="#3fb68b" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BinCard({ bin, active, order, onClick }) {
  const st = statusFor(bin.pct, bin.threshold);
  const color = STATUS_COLOR[st.code];
  const pct = clampPct(bin.pct);
  const hasSignal = bin.pct != null && bin.pct >= 0;
  return (
    <button
      className={`bincard${active ? " active" : ""}${order != null ? " route" : ""}`}
      onClick={onClick}
    >
      <div className="gauge" aria-hidden>
        <div className="fluid" style={{ height: `${pct}%`, background: color }} />
      </div>
      <div className="binbody">
        <div className="name">
          {order != null ? <span style={{ color: "var(--accent)" }}>{order}. </span> : null}
          {bin.name}
        </div>
        <div className="meta">
          <span>{bin.id}</span>
          {hasSignal ? <span>{bin.dist_cm?.toFixed?.(1) ?? "--"} cm</span> : null}
          <span>{timeAgo(bin.last_seen)}</span>
        </div>
      </div>
      <div className="binright">
        <div className="pct" style={{ color }}>
          {hasSignal ? `${Math.round(bin.pct)}%` : "--"}
        </div>
        <span className="badge" style={{ color }}>{st.label}</span>
      </div>
    </button>
  );
}

/* pin html for the leaflet markers */
function binPinHtml(pct, color, order) {
  const h = clampPct(pct);
  const num = order != null ? `<div class="num">${order}</div>` : "";
  return `<div class="pin"><div class="bin"><div class="fill" style="height:${h}%;background:${color}"></div></div>${num}</div>`;
}

/* ================= main ================= */
export default function Page() {
  const [bins, setBins] = useState(DEMO_BINS);
  const [loading, setLoading] = useState(isConfigured);
  const [selectedId, setSelectedId] = useState(null);
  const [route, setRoute] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [ready, setReady] = useState(false);

  const elRef = useRef(null);
  const LRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeRef = useRef(null);
  const depotRef = useRef(null);

  /* data load */
  const load = useCallback(async () => {
    if (!isConfigured || !supabase) return;
    const { data, error } = await supabase
      .from("bin_status")
      .select("*")
      .order("pct", { ascending: false });
    if (!error && data) {
      setBins(data);
      setLastUpdate(Date.now());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isConfigured || !supabase) return;
    load();
    const channel = supabase
      .channel("readings-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        () => load()
      )
      .subscribe();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [load]);

  /* init leaflet (browser only) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      if (cancelled || !elRef.current || mapRef.current) return;
      const L = mod.default;
      LRef.current = L;
      const map = L.map(elRef.current, {
        center: [MAP_CENTER.lat, MAP_CENTER.lng],
        zoom: MAP_ZOOM,
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
      ).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  }, []);

  const orderIndex = useMemo(() => {
    if (!route) return null;
    const m = {};
    route.ordered.forEach((b, i) => (m[b.id] = i + 1));
    return m;
  }, [route]);

  /* depot marker */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (depotRef.current) depotRef.current.remove();
    const icon = L.divIcon({
      html: `<div class="pin depot"><div class="bin"></div></div>`,
      className: "",
      iconSize: [30, 42],
      iconAnchor: [15, 42],
    });
    depotRef.current = L.marker([DEPOT.lat, DEPOT.lng], { icon })
      .addTo(map)
      .bindPopup(`<b>${DEPOT.name}</b><br/>Truck start / return`);
  }, [ready]);

  /* bin markers */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    Object.keys(markersRef.current).forEach((id) => {
      if (!bins.find((b) => b.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    bins.forEach((b) => {
      const st = statusFor(b.pct, b.threshold);
      const color = STATUS_COLOR[st.code];
      const order = orderIndex ? orderIndex[b.id] : null;
      const icon = L.divIcon({
        html: binPinHtml(b.pct, color, order),
        className: "",
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      });
      const popup = `<b>${b.name}</b><br/>${
        b.pct != null && b.pct >= 0 ? Math.round(b.pct) + "% full" : "no signal"
      } &middot; ${st.label}`;
      if (markersRef.current[b.id]) {
        markersRef.current[b.id].setIcon(icon).setPopupContent(popup);
      } else {
        const m = L.marker([b.lat, b.lng], { icon }).addTo(map).bindPopup(popup);
        m.on("click", () => setSelectedId(b.id));
        markersRef.current[b.id] = m;
      }
    });
  }, [ready, bins, orderIndex]);

  /* route polyline */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (route && route.path && route.path.length > 1) {
      const latlngs = route.path.map((p) => [p.lat, p.lng]);
      routeRef.current = L.polyline(latlngs, {
        color: "#2dd4bf",
        weight: 3,
        opacity: 0.9,
        dashArray: "1 8",
        lineCap: "round",
      }).addTo(map);
      map.fitBounds(routeRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [ready, route]);

  /* pan to selected */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const b = bins.find((x) => x.id === selectedId);
    if (b) {
      map.panTo([b.lat, b.lng], { animate: true });
      const m = markersRef.current[selectedId];
      if (m) m.openPopup();
    }
  }, [ready, selectedId, bins]);

  /* derived */
  const sorted = useMemo(
    () => [...bins].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)),
    [bins]
  );
  const needCollect = useMemo(
    () => bins.filter((b) => b.pct != null && b.pct >= b.threshold),
    [bins]
  );
  const avgFill = useMemo(() => {
    const vals = bins.filter((b) => b.pct != null && b.pct >= 0).map((b) => b.pct);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [bins]);
  const skipped = Math.max(0, bins.length - needCollect.length);
  const savings = Math.round(skipped * COST_PER_STOP_USD);
  const stale = Date.now() - lastUpdate > REFRESH_MS * 2;

  const handleOptimize = useCallback(() => {
    const stops = needCollect.map((b) => ({
      id: b.id,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
    }));
    if (!stops.length) {
      setRoute({ ordered: [], path: [], distanceKm: 0 });
      return;
    }
    setRoute(optimizeRoute(DEPOT, stops));
  }, [needCollect]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BrandGlyph />
          <div>
            <h1>Bin<span>Sync</span></h1>
            <small>Live bin network</small>
          </div>
        </div>
        <div className="spacer" />
        <div className="livepill">
          <span className={`livedot${stale ? " stale" : ""}`} />
          {isConfigured
            ? `updated ${timeAgo(new Date(lastUpdate).toISOString())}`
            : "demo data"}
        </div>
        <button className="btn" onClick={handleOptimize}>Optimize route</button>
      </header>

      {!isConfigured && (
        <div className="banner">
          <span>Showing demo data. Add your Supabase keys in Vercel to go live.</span>
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="k">Bins online</div>
          <div className="v">{bins.length}</div>
          <div className="sub">across the network</div>
        </div>
        <div className="stat">
          <div className="k">Need collection</div>
          <div className={`v${needCollect.length ? " warn" : ""}`}>{needCollect.length}</div>
          <div className="sub">at or above threshold</div>
        </div>
        <div className="stat">
          <div className="k">Average fill</div>
          <div className="v">{avgFill}%</div>
          <div className="sub">network-wide</div>
        </div>
        <div className="stat">
          <div className="k">Stops skipped</div>
          <div className="v">{skipped}</div>
          <div className="sub">~${savings} saved this run</div>
        </div>
      </div>

      <div className="main">
        <div className="mapcol">
          <div className="map" ref={elRef} />
          {route && (
            <div className="routechip">
              {route.ordered.length ? (
                <>
                  <div>
                    <div className="rk">Route</div>
                    <div className="rv">
                      {route.ordered.length} stops{" "}
                      <small>&middot; {route.distanceKm.toFixed(1)} km loop</small>
                    </div>
                  </div>
                  <button className="clear" onClick={() => setRoute(null)}>clear</button>
                </>
              ) : (
                <>
                  <div>
                    <div className="rk">Route</div>
                    <div className="rv">
                      Nothing to collect <small>&middot; all bins under threshold</small>
                    </div>
                  </div>
                  <button className="clear" onClick={() => setRoute(null)}>dismiss</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="listcol">
          <div className="listhead">
            <h2>Bins by fill level</h2>
            <span className="hint">{loading ? "loading…" : "tap to locate"}</span>
          </div>
          <div className="list">
            {sorted.length === 0 && !loading ? (
              <div className="empty">No bins yet. Add rows to the bins table.</div>
            ) : (
              sorted.map((b) => (
                <BinCard
                  key={b.id}
                  bin={b}
                  active={selectedId === b.id}
                  order={orderIndex ? orderIndex[b.id] ?? null : null}
                  onClick={() => setSelectedId(b.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
