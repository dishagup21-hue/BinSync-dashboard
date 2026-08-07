// Great-circle distance between two {lat,lng} points, in kilometers.
export function haversineKm(a, b) {
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

// Nearest-neighbor collection route: start at the depot, always drive to the
// closest not-yet-visited bin, then loop back to the depot at the end.
// Good enough for the handful of bins on a campus/park and instant to compute.
export function optimizeRoute(depot, stops) {
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

  // Path drawn on the map: depot -> each bin in order -> depot.
  const path = [depot, ...ordered, depot];
  return { ordered, path, distanceKm };
}
