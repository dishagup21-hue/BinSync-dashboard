import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// If env vars aren't set yet (e.g. before you wire up Supabase), the app
// falls back to bundled demo data so the site still renders.
export const isConfigured = Boolean(url && key);

export const supabase = isConfigured ? createClient(url, key) : null;
