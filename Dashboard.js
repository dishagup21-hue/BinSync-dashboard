"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase, isConfigured } from "@/lib/supabaseClient";
import { DEMO_BINS } from "@/lib/demoData";
import { DEPOT, REFRESH_MS, COST_PER_STOP_USD } from "@/lib/config";
import { optimizeRoute } from "@/lib/optimize";
import {
  statusFor,
  STATUS_COLOR,
  clampPct,
  timeAgo,
} from "@/lib/format";

const BinMap = dynamic(() => import("./BinMap"), {
  ssr: false,
  loading: () => <div className="map" />,
});

function BrandGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="9" width="14" height="12" rx="2" fill="#16211f" stroke="#2dd4bf" strokeWidth="1.6" />
      <rect x="5" y="15" width="14" height="6" rx="0" fill="#2dd4bf" opacity="0.85" />
      <path d="M8 6.5h8" stroke="#2dd4bf" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 2.5a3.4 3.4 0 0 1 3.4 3.4M12 4.6a1.3 1.3 0 0 1 1.3 1.3" stroke="#3fb68b" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BinCard({ bin, active, inRoute, order, onClick }) {
  const st = statusFor(bin.pct, bin.threshold);
  const color = STATUS_COLOR[st.code];
  const pct = clampPct(bin.pct);
  const hasSignal = bin.pct != null && bin.pct >= 0;
  return (
    <button
      className={`bincard${active ? " active" : ""}${inRoute ? " route" : ""}`}
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
        <span className="badge" style={{ color }}>
          {st.label}
        </span>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const [bins, setBins] = useState(DEMO_BINS);
  const [loading, setLoading] = useState(isConfigured);
  const [selectedId, setSelectedId] = useState(null);
  const [route, setRoute] = useState(null); // { ordered, path, distanceKm }
  const [lastUpdate, setLastUpdate] = useState(Date.now());

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

  // initial load + realtime + polling backstop
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

  const orderIndex = useMemo(() => {
    if (!route) return null;
    const map = {};
    route.ordered.forEach((b, i) => (map[b.id] = i + 1));
    return map;
  }, [route]);

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

  const clearRoute = () => setRoute(null);

  const stale = Date.now() - lastUpdate > REFRESH_MS * 2;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BrandGlyph />
          <div>
            <h1>
              Bin<span>Sync</span>
            </h1>
            <small>Live bin network</small>
          </div>
        </div>
        <div className="spacer" />
        <div className="livepill">
          <span className={`livedot${stale ? " stale" : ""}`} />
          {isConfigured ? `updated ${timeAgo(new Date(lastUpdate).toISOString())}` : "demo data"}
        </div>
        <button className="btn" onClick={handleOptimize}>
          Optimize route
        </button>
      </header>

      {!isConfigured && (
        <div className="banner">
          <span>
            Showing demo data. Add your Supabase keys (see README) to go live.
          </span>
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
          <div className={`v${needCollect.length ? " warn" : ""}`}>
            {needCollect.length}
          </div>
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
          <BinMap
            bins={bins}
            depot={DEPOT}
            selectedId={selectedId}
            onSelect={setSelectedId}
            routePath={route ? route.path : null}
            orderIndex={orderIndex}
          />
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
                  <button className="clear" onClick={clearRoute}>
                    clear
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <div className="rk">Route</div>
                    <div className="rv">
                      Nothing to collect <small>&middot; all bins under threshold</small>
                    </div>
                  </div>
                  <button className="clear" onClick={clearRoute}>
                    dismiss
                  </button>
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
              <div className="empty">
                No bins yet. Add rows to the <code>bins</code> table and your
                ESP32 will start reporting.
              </div>
            ) : (
              sorted.map((b) => (
                <BinCard
                  key={b.id}
                  bin={b}
                  active={selectedId === b.id}
                  inRoute={orderIndex ? orderIndex[b.id] != null : false}
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
