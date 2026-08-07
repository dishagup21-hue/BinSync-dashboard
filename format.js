import { FILLING_PCT } from "./config";

// Derive display status from fill % and the bin's own collect threshold.
// Returned code is used for colors; label is what the operator reads.
export function statusFor(pct, threshold = 85) {
  if (pct == null || Number.isNaN(pct) || pct < 0) {
    return { code: "offline", label: "No signal" };
  }
  if (pct >= threshold) return { code: "collect", label: "Collect now" };
  if (pct >= FILLING_PCT) return { code: "filling", label: "Filling" };
  return { code: "ok", label: "OK" };
}

export const STATUS_COLOR = {
  collect: "var(--collect)",
  filling: "var(--filling)",
  ok: "var(--ok)",
  offline: "var(--muted)",
};

export function clampPct(pct) {
  if (pct == null || Number.isNaN(pct) || pct < 0) return 0;
  return Math.max(0, Math.min(100, pct));
}

// "3m ago", "2h ago", "just now"
export function timeAgo(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
