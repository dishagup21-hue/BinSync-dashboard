# BinSync — Live Dashboard

Real-time fill-level monitoring and collection-route optimization for
retrofitted trash bins. ESP32 sensors push readings to Supabase; this Next.js
dashboard shows every bin on a map, live, and plans an optimized truck route
over the bins that actually need collecting.

```
ESP32  →  Supabase (Postgres)  →  This dashboard (Vercel)
```

The app ships with demo data, so it renders immediately — even before you
connect Supabase. Wire up the keys and live data takes over automatically.

---

## The order to do this in

1. Create the Supabase project + database (Step 1)
2. Run the app locally to confirm it works (Step 2)
3. Push to GitHub (Step 3)
4. Deploy to Vercel with your keys (Step 4)
5. Flash the ESP32 firmware (Step 5)

---

## Step 1 — Supabase

1. Go to supabase.com, sign in, **New project**. Pick a name, a database
   password, and a region near you. Wait ~2 minutes for it to provision.
2. Open **SQL Editor → New query**. Paste the entire contents of
   `supabase/schema.sql` and click **Run**. This creates the `bins` and
   `readings` tables, the `bin_status` view, security policies, realtime, and
   six demo bins near NYU Tandon.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon public** key (the long one safe for browsers)

Keep those two handy for the next steps.

## Step 2 — Run it locally

```bash
npm install
cp .env.local.example .env.local     # then paste your two values in
npm run dev
```

Open http://localhost:3000. You should see the six bins on the map with live
fill levels. Click **Optimize route** to plan a collection loop.

If `.env.local` is missing or blank, the app just shows demo data — that's
expected.

## Step 3 — Push to GitHub

Create an empty repo on github.com (no README/gitignore — this project already
has them), then:

```bash
git init
git add .
git commit -m "BinSync dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/binsync-dashboard.git
git push -u origin main
```

`.env.local` is gitignored, so your keys are **not** pushed. Good.

## Step 4 — Deploy to Vercel

1. Go to vercel.com and sign in **with GitHub**.
2. **Add New → Project**, then **Import** your `binsync-dashboard` repo.
   Vercel auto-detects Next.js — leave the build settings as-is.
3. Before deploying, open **Environment Variables** and add both:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key |

4. Click **Deploy**. In ~2 minutes you get a live URL.

> If you add or change env vars *after* the first deploy, Vercel doesn't
> auto-rebuild — go to **Deployments → latest → Redeploy** so the new values
> get baked in (the `NEXT_PUBLIC_` values are read at build time).

Every future `git push` to `main` redeploys automatically.

## Step 5 — Flash the ESP32

Open `firmware/binsync_esp32.ino` in the Arduino IDE (ESP32 board support
installed). Edit the CONFIG block at the top:

- `WIFI_SSID` / `WIFI_PASS` — the venue's WiFi
- `SUPABASE_URL` / `SUPABASE_KEY` — same two values from Step 1
- `BIN_ID` — must match a row in the `bins` table (e.g. `bin_01`)
- `BIN_DEPTH_CM` — distance from the sensor to the empty bin floor

Flash it. On each wake the board reads the sensor, POSTs one reading to
Supabase, and deep-sleeps for `SLEEP_MINUTES`. The dashboard updates within
seconds of each POST. Give each physical bin its own `BIN_ID`.

To test without waiting for deep sleep, temporarily set `SLEEP_MINUTES` low
(e.g. 1) and watch the Serial Monitor at 115200 baud for the `HTTP 201`.

---

## Customizing

- **Your real bins:** edit the `insert into bins ...` rows in `schema.sql`
  (or add rows in the Supabase Table Editor). Set each bin's real `lat`/`lng`
  and `threshold`.
- **Truck depot / map center:** `lib/config.js` → `DEPOT`, `MAP_CENTER`.
- **When a bin flags "collect":** the per-bin `threshold` column (default 85%).
- **Warning band + savings assumptions:** `lib/config.js`.

## How the route works

`lib/optimize.js` runs a nearest-neighbor loop: start at the depot, always
drive to the closest not-yet-visited bin that's over its threshold, then return
to the depot. Fast and good for a campus-sized network. It's a clean place to
drop in a stronger solver later.

## Security note

The schema lets anything holding the **anon** key insert readings — fine to
start with. To harden it, POST from the ESP32 using a Supabase **secret** key
with a stricter insert policy, or route inserts through a Supabase Edge
Function. The dashboard only ever needs read access.

## Stack

Next.js (App Router) · Supabase (Postgres + realtime) · Leaflet + CARTO tiles ·
deployed on Vercel. No API keys needed for the map.
