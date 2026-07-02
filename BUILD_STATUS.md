# INTUS Platform — Build Status (2026-07-01)

Unified app: the intus_platform_1.html UI (Hub, Prefactibilidad, Mapa Estratégico,
Referenciales) + the Capital Research module (dashboard-frontend app) in ONE
Vite frontend + ONE Express backend. The original `research project/` folder is
FROZEN — never modify it.

## ✅ Done

1. **Foundation** — `research project/` copied here (no node_modules), git repo
   initialized (identity jpaiz@intuscorp.com), HTML secured at
   `reference/intus_platform_1.html`, deps installed. Commits: `adca858` baseline,
   `a81822b` shell.

2. **Legacy extraction** — `frontend/scripts/extract-legacy.mjs` slices the HTML
   app byte-identically into:
   - `frontend/src/data/potPolygons.js` (the 193KB POT_POLYS line)
   - `frontend/src/legacy/core.js` (calc engine, defaults D, zone data ZG, INCS,
     incentives calc, formatters, storage helpers)
   - `frontend/src/legacy/{ui.jsx, MapView.jsx, Platform.jsx, Referenciales.jsx, Hub.jsx}`
   Re-runnable via `npm run extract`. **`npx vite build` passes (93 modules).**
   **Engine parity values** (calc(D) in Node — must match in browser):
   TIR BT 24.53%, TIR AT 20.64%, MOIC BT 2.07x, vProy $46,886,276, nApt 153, dur 50 meses.

3. **Shell** — `frontend/src/App.jsx` (tabs: Hub/Prefactibilidad/Mapa/Referenciales/
   Capital Research; status banners; user menu), `src/lib/AuthContext.jsx` (Google
   OAuth + password, @intuscorp.com enforced client-side, **modo local** fallback
   when Supabase env missing), `src/lib/supabase.js`, `src/lib/api.js` (global fetch
   interceptor adds Bearer token to /api calls), `src/lib/projectsStore.js`
   (Supabase `platform_projects` table + localStorage fallback, legacy array
   semantics preserved), `src/components/LoginPage.jsx` (Google button, INTUS logo),
   Hub edited: Capital Research card added, "Inteligencia de mercado" removed from
   Próximamente. JSON export/import of projects preserved (HubView).
   `supabase/schema.sql` — run in Supabase SQL editor: creates `platform_projects`
   + RLS + Google OAuth setup instructions in comments.

4. **Backend** — `.env` PORT=3002 (frozen app keeps 3001). Optional auth:
   `backend/middleware/requireAuth.js` validates Supabase token + @intuscorp.com,
   OFF by default, enable with `REQUIRE_AUTH=true` (wired in server.js for /api and
   /dashboard-outputs; /api/status exempt). Supabase persistence for research
   already existed (tables: sectors, research_runs, industries, formats, risks,
   recommendations + market data). backend/.env already has SUPABASE_URL +
   SUPABASE_SERVICE_KEY (copied from original).

## 🔄 In flight (background agent — check if its output landed)

**Capital Research port**: agent porting `dashboard-frontend/src/` →
`frontend/src/modules/capital-research/`:
- `CapitalResearch.jsx` ({active} prop, root `<div className="cr-scope">`), two
  sub-tabs: **Investigación de Industrias** (inner: Investigación=ResearchPanel /
  Dashboard=Weight+Tier+Rank+Arch+ScoringTable+download+editMode / Historial) and
  **Investigación de Mercado** (MarketIntelPanel kept mounted, CSS-hidden).
- Components copied with imports rewired (supabaseClient→`src/lib/supabase.js`,
  AuthContext→`src/lib/AuthContext.jsx`).
- CSS: `frontend/scripts/scope-cr-css.mjs` wraps the 88KB index.css in `.cr-scope`
  (nesting compiled by postcss-nested), hoisting :root/@keyframes/@font-face;
  output at `frontend/src/modules/capital-research/capital-research.css`
  (main.jsx already imports it).
- Agent must leave `npx vite build` green.
**If the placeholder text "Módulo en construcción" is still in CapitalResearch.jsx,
the agent did not finish — redo per the spec above.**

## ⬜ Remaining

1. **Verify in browser** (nothing verified visually yet!):
   - `cd backend; npm install; npm run dev` (port 3002, set MOCK_API=true first to avoid API cost)
   - `cd frontend; npm run dev` (port 5174, proxies /api→3002)
   - Modo local banner appears (frontend/.env not created yet — expected).
   - Hub: 4 module cards + metrics. Prefactibilidad: create project with defaults,
     walk the 9 steps, Resultados must show the parity values above. Guardar → reload
     persists (localStorage in modo local). Mapa: tiles render, POT polygons draw,
     click detects zone, dibujar/medir work, project markers+popups. Referenciales:
     tables. Capital Research: sub-tabs render, research form hits backend (mock),
     historial lists runs, Mercado dashboard renders, no CSS bleed between platform
     (Tailwind emerald) and CR module (.cr-scope).
   - Fix console errors. Likely risk spots: missing imports in extracted legacy
     modules (build passes but undefined identifiers surface at runtime — check each
     view), Leaflet marker icons (fix already applied in MapView header), CR CSS scoping.
2. **Commit** agent output + fixes; milestone commits.
3. **User-side steps (documented in supabase/schema.sql):**
   - Provide `frontend/.env`: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (anon key
     from Supabase dashboard → Settings → API; NOT in any local file yet — backend
     has service key only, dashboard-frontend env files only had VITE_API_BASE,
     Supabase frontend keys were only ever set in Vercel).
   - Run `supabase/schema.sql` in Supabase SQL editor.
   - Google OAuth: create OAuth client in Google Cloud Console, enable Google
     provider in Supabase, add redirect URL http://localhost:5174.
4. **Platform projects migration**: export JSON from the old HTML app (Hub →
   Exportar datos) → import in new app (Hub → Importar datos) once cloud mode is on.
5. **Deploy** (later, user does): frontend → Vercel (own project), backend →
   Railway (own service, set REQUIRE_AUTH=true), set VITE_API_BASE to Railway URL.
6. Optional cleanup: retire `frontend`-era leftovers, decide whether
   `dashboard-frontend/` stays in repo as reference or gets removed after the port
   is confirmed working.

## Run commands
```
# Terminal 1                          # Terminal 2
cd "INTUS Platform/backend"           cd "INTUS Platform/frontend"
npm install                           npm run dev   → http://localhost:5174
npm run dev  → :3002
```

## Session log 2026-07-02
- backend npm install completed (node_modules was empty after copy).
- Capital Research port agent attempts FAILED twice: first died with the previous session process; relaunch blocked by account session limit (resets 1:50am). Module is still the placeholder — redo per the 'In flight' spec above.
