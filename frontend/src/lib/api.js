import { supabase } from './supabase.js';

export const API_BASE = import.meta.env.VITE_API_BASE || '';

// The Capital Research components (ported from dashboard-frontend) call
// fetch('/api/...') directly in many places. Instead of touching every call
// site, install a fetch wrapper once: any request to our API gets the
// Supabase access token attached so the backend can validate the user.
let installed = false;
export function installApiAuth() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    try {
      const url = typeof input === 'string' ? input : (input?.url ?? '');
      const isApi =
        url.startsWith('/api') ||
        url.startsWith('/dashboard-outputs') ||
        (API_BASE && url.startsWith(API_BASE));
      if (isApi && supabase) {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (token) {
          init = { ...(init || {}) };
          init.headers = { ...(init.headers || {}) };
          if (!init.headers.Authorization && !init.headers.authorization) {
            init.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
    } catch { /* never block a request over auth decoration */ }
    return orig(input, init);
  };
}
