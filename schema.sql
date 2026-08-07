-- ============================================================
--  BinSync database schema
--  Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- ============================================================

-- One row per physical bin. `id` must match the BIN_ID in each ESP32.
create table if not exists bins (
  id          text primary key,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  depth_cm    real not null default 30,
  threshold   int  not null default 85,   -- % fill that flags "collect now"
  created_at  timestamptz default now()
);

-- Append-only telemetry from the sensors.
create table if not exists readings (
  id          bigint generated always as identity primary key,
  bin_id      text not null references bins(id) on delete cascade,
  dist_cm     real,
  pct         real,
  level       text,
  created_at  timestamptz default now()
);

create index if not exists readings_bin_time
  on readings (bin_id, created_at desc);

-- Latest reading per bin, joined with the bin's metadata.
-- The dashboard reads this one view.
create or replace view bin_status
with (security_invoker = on) as
select
  b.id, b.name, b.lat, b.lng, b.depth_cm, b.threshold,
  r.dist_cm, r.pct, r.level,
  r.created_at as last_seen
from bins b
left join lateral (
  select dist_cm, pct, level, created_at
  from readings
  where readings.bin_id = b.id
  order by created_at desc
  limit 1
) r on true;

grant select on bin_status to anon, authenticated;

-- ---------- Row Level Security ----------
alter table bins     enable row level security;
alter table readings enable row level security;

-- Anyone can read (public dashboard).
drop policy if exists "public read bins" on bins;
create policy "public read bins" on bins
  for select using (true);

drop policy if exists "public read readings" on readings;
create policy "public read readings" on readings
  for select using (true);

-- Devices post readings with the anon key.
-- NOTE: this lets anyone holding the anon key insert readings. Fine to start;
-- for a hardened setup, POST from the ESP32 with a secret key + a stricter
-- policy, or route inserts through a Supabase Edge Function.
drop policy if exists "device insert readings" on readings;
create policy "device insert readings" on readings
  for insert with check (true);

-- ---------- Realtime ----------
-- Push new readings to the dashboard instantly.
alter publication supabase_realtime add table readings;

-- ---------- Seed: demo bins near NYU Tandon (edit to your real bins) ----------
insert into bins (id, name, lat, lng, depth_cm, threshold) values
  ('bin_01', 'Jay St Entrance',   40.6939, -73.9868, 30, 85),
  ('bin_02', 'MetroTech Commons', 40.6947, -73.9856, 30, 85),
  ('bin_03', 'Rogers Hall',       40.6935, -73.9849, 30, 85),
  ('bin_04', 'Dibner Library',    40.6952, -73.9862, 30, 85),
  ('bin_05', 'Willoughby Plaza',  40.6928, -73.9871, 30, 85),
  ('bin_06', 'Bridge St Lot',     40.6960, -73.9845, 30, 85)
on conflict (id) do nothing;

-- Optional: a few starter readings so the dashboard isn't empty before the
-- hardware is live. Safe to delete these once real data flows in.
insert into readings (bin_id, dist_cm, pct, level) values
  ('bin_01', 2.4,  92, 'FULL'),
  ('bin_02', 8.7,  71, 'MEDIUM'),
  ('bin_03', 20.1, 33, 'LOW'),
  ('bin_04', 3.6,  88, 'FULL'),
  ('bin_05', 24.6, 18, 'LOW'),
  ('bin_06', 10.8, 64, 'MEDIUM');
