import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidUrl(s) {
  try { return /^https?:\/\//i.test(s); } catch { return false; }
}

let supabase = null;
if (url && key && isValidUrl(url)) {
  try { supabase = createClient(url, key); }
  catch (e) { console.error('[auth] Supabase client failed to initialize:', e.message); }
} else if (url || key) {
  console.warn('[auth] VITE_SUPABASE_URL must start with https:// — auth disabled. Current value:', url);
}

export { supabase };
