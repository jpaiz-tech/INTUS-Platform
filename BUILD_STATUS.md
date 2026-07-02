# INTUS Platform — Build Status (2026-07-02)

Unified app: the intus_platform_1.html UI (Hub, Prefactibilidad, Mapa Estratégico,
Referenciales) + the Capital Research module (dashboard-frontend app) in ONE
Vite frontend + ONE Express backend. The original `research project/` folder is
FROZEN — never modify it.

## ✅ Done

1. **Foundation** — `research project/` copied here (no node_modules), git repo
   initialized (identity jpaiz@intuscorp.com), HTML secured at
   `reference/intus_platform_1.html`, deps installed.

2. **Legacy extraction** — `frontend/scripts/extract-legacy.mjs` slices the HTML
   app byte-identically into:
   - `frontend/src/data/potPolygons.js` (the 193KB POT_POLYS line)
   - `frontend/src/legacy/core.js` (calc engine, defaults D, zone data ZG, INCS,
     incentives calc, formatters, storage helpers)
   - `frontend/src/legacy/{ui.jsx, MapView.jsx, Platform.jsx, Referenciales.jsx, Hub.jsx}`
   Re-runnable via `npm run extract`.
   **Engine parity values** (calc(D) in Node — must match in browser):
   TIR BT 24.53%, TIR AT 20.64%, MOIC BT 2.07x, vProy $46,886,276, nApt 153, dur 50 meses.
   *Browser-verified: Hub ✅, Prefactibilidad ✅ (TIR 25.0%, MOIC 2.10x), Mapa ✅.*

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
   OFF by default, enable with `REQUIRE_AUTH=true`. Supabase persistence for
   research already existed (sectors, research_runs, industries, formats, risks,
   recommendations + market data).

5. **Capital Research module** — Full port from `research project/dashboard-frontend/`:
   - `frontend/src/modules/capital-research/CapitalResearch.jsx` — two sub-tabs:
     **Investigación de Industrias** (inner tabs: Investigación / Dashboard / Historial)
     and **Investigación de Mercado** (MarketIntelPanel, CSS-hidden when not active).
   - All components in `components/` and `components/marketIntel/` — imports rewired
     to `src/lib/supabase.js` and `src/lib/AuthContext.jsx`.
   - `capital-research.css` — 88KB CR styles scoped under `.cr-scope`.
   - `api.js`, `utils.js`, `utils/reportHtml.js`, logo assets all ported.
   - **`npx vite build` passes — 113 modules, 0 errors.** (Chunk size warning is
     expected at 695KB; production deploy can code-split later.)

   **REF_DATA fix**: Platform.jsx now exports REF_DATA, REF_CONST_LABELS,
   REF_EQUIP_LABELS, REF_TECH_LABELS; Referenciales.jsx imports them from there.
   extract-legacy.mjs updated to match.

## ⬜ Remaining

1. **Browser verify** — start both servers and confirm:
   - Referenciales tables render (REF_DATA fix not yet hard-reloaded in browser).
   - Capital Research sub-tabs render, research form hits backend, historial lists
     runs, Mercado dashboard renders, no CSS bleed.
   - No console errors on any tab.

2. **User-side steps** (documented in `supabase/schema.sql`):
   - Create `frontend/.env`:
     ```
     VITE_SUPABASE_URL=https://xxxx.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJ...
     VITE_API_BASE=http://localhost:3002
     ```
     (Anon key: Supabase dashboard → Settings → API. Service key is already in
     `backend/.env` — copied from original. Frontend Supabase keys were previously
     only in Vercel env vars, never in a local file.)
   - Run `supabase/schema.sql` in Supabase SQL editor.
   - Google OAuth: create OAuth client in Google Cloud Console, enable Google
     provider in Supabase Auth, add redirect URL http://localhost:5174.

3. **Platform projects migration**: export JSON from the old HTML app
   (Hub → Exportar datos) → import in new app (Hub → Importar datos) once
   cloud mode is on.

4. **Deploy** (user does, later):
   - Frontend → Vercel (new project in this folder, set VITE_SUPABASE_* + VITE_API_BASE).
   - Backend → Railway (set REQUIRE_AUTH=true, port auto-assigned).
   - Update Supabase Google OAuth redirect URL to the Vercel domain.

5. Optional: retire `dashboard-frontend/` from the repo once Capital Research
   is confirmed working in the platform.

## Run commands

```
# Terminal 1 — backend          # Terminal 2 — frontend
cd "INTUS Platform/backend"     cd "INTUS Platform/frontend"
npm run dev  → :3002            npm run dev  → :5174
```

Set `MOCK_API=true` in `backend/.env` to avoid API costs during development.

## Session log

**2026-07-01** Foundation, extraction, shell, backend.
**2026-07-02** Capital Research fully ported (113 modules, build green). REF_DATA
export/import fix applied to Platform.jsx + Referenciales.jsx + extract-legacy.mjs.
Browser-verified: Hub ✅, Prefactibilidad ✅, Mapa ✅. Referenciales and Capital
Research pending hard-reload verification.
