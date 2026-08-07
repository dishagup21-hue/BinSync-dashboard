"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/config";
import { statusFor, STATUS_COLOR, clampPct } from "@/lib/format";

function binPinHtml(pct, color, order) {
  const h = clampPct(pct);
  const num =
    order != null ? `<div class="num">${order}</div>` : "";
  return `
    <div class="pin">
      <div class="bin">
        <div class="fill" style="height:${h}%;background:${color}"></div>
      </div>
      ${num}
    </div>`;
}

function depotPinHtml() {
  return `<div class="pin depot"><div class="bin"></div></div>`;
}

export default function BinMap({
  bins,
  depot,
  selectedId,
  onSelect,
  routePath,
  orderIndex, // { [binId]: number }
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const routeRef = useRef(null);
  const depotRef = useRef(null);

  // init once
  useEffect(() => {
    if (mapRef.current || !elRef.current) return;
    const map = L.map(elRef.current, {
      center: [MAP_CENTER.lat, MAP_CENTER.lng],
      zoom: MAP_ZOOM,
      zoomControl: true,
      attributionControl: true,
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

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // depot marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !depot) return;
    if (depotRef.current) depotRef.current.remove();
    const icon = L.divIcon({
      html: depotPinHtml(),
      className: "",
      iconSize: [30, 42],
      iconAnchor: [15, 42],
    });
    depotRef.current = L.marker([depot.lat, depot.lng], { icon })
      .addTo(map)
      .bindPopup(`<b>${depot.name}</b><br/>Truck start / return`);
  }, [depot]);

  // bin markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // remove stale
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
        const m = L.marker([b.lat, b.lng], { icon })
          .addTo(map)
          .bindPopup(popup);
        m.on("click", () => onSelect && onSelect(b.id));
        markersRef.current[b.id] = m;
      }
    });
  }, [bins, orderIndex, onSelect]);

  // route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (routePath && routePath.length > 1) {
      const latlngs = routePath.map((p) => [p.lat, p.lng]);
      routeRef.current = L.polyline(latlngs, {
        color: "#2dd4bf",
        weight: 3,
        opacity: 0.9,
        dashArray: "1 8",
        lineCap: "round",
      }).addTo(map);
      map.fitBounds(routeRef.current.getBounds(), { padding: [50, 50] });
    }
  }, [routePath]);

  // pan to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const b = bins.find((x) => x.id === selectedId);
    if (b) {
      map.panTo([b.lat, b.lng], { animate: true });
      const m = markersRef.current[selectedId];
      if (m) m.openPopup();
    }
  }, [selectedId, bins]);

  return <div className="map" ref={elRef} />;
}
