# ETRA Dashboard — Full Project Briefing
*Last updated: 2026-06-30. Paste this entire file into a new chat to resume work.*

---

## 1. WHAT THIS PROJECT IS

An internal real estate market intelligence dashboard called **ETRA**. Built for an acquisitions team intern project. The app has two main purposes:

1. **Research Pipeline** (older, mostly done) — paste a property/market, run multi-agent Claude research, get a scored report
2. **Market Intelligence Module** (active development) — upload PDFs/broker reports → auto-extract structured market data → browse/filter/print one-page market summaries

The intern's assignment: build and maintain a market database (cap rates, rents, vacancy, absorption by country/submarket) and produce one-page reports per country/sector. The app IS the deliverable tool.

---

## 2. TECH STACK

| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React + Vite | Vercel (auto-deploy from GitHub main) |
| Backend | Node.js Express, ES modules | Railway (auto-deploy from GitHub main) |
| Database | Supabase (PostgreSQL) | Supabase cloud |
| AI | Anthropic Claude API | Called from backend only |
| Data source | Google Sheets | Synced via Apps Script Web App |
| Repo | GitHub | `jpaiz-tech/Industry-Report` |

**Railway URL:** `https://industry-report-production.up.railway.app`  
**Vercel URL:** (check Vercel dashboard — auto-assigned)  
**Supabase project:** `trcxfzrvgqhyeeglatle.supabase.co`  
**GitHub repo:** `https://github.com/jpaiz-tech/Industry-Report`

---

## 3. ENVIRONMENT VARIABLES

### Railway (backend) — set in Railway dashboard
```
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_MODEL_CHEAP=claude-haiku-4-5-20251001
SUPABASE_URL=https://trcxfzrvgqhyeeglatle.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
PORT=3001
```

### Vercel (frontend) — set in Vercel dashboard
```
VITE_API_BASE=https://industry-report-production.up.railway.app
```

### Local dev (backend/.env)
Same as Railway vars above. This file is in .gitignore — never commit it.

**SECURITY RULE:** Claude API key lives in backend `.env` only. Never sent to frontend.

---

## 4. PROJECT FILE STRUCTURE

```
research project/
├── backend/
│   ├── server.js                        # Express app entry, mounts all routers
│   ├── routes/
│   │   ├── marketData.js                # All /api/market-data/* endpoints
│   │   ├── research.js                  # Research pipeline routes
│   │   ├── report.js                    # Report generation
│   │   └── ... (other older routes)
│   ├── services/
│   │   ├── marketDataService.js         # Claude PDF/text extraction (extractMarketRows)
│   │   ├── marketDataAggregator.js      # Pure JS aggregation (no Claude, no DB)
│   │   ├── marketDataDb.js              # Supabase queries for market_data table
│   │   ├── googleSheetsService.js       # Apps Script bridge (fetch/parse/write)
│   │   └── ... (other older services)
│   ├── utils/
│   │   └── supabaseClient.js            # Supabase client singleton
│   └── .env                             # Local only, gitignored
├── dashboard-frontend/
│   ├── src/
│   │   ├── App.jsx                      # Main app, tab routing
│   │   ├── index.css                    # All styles (~2900 lines)
│   │   ├── AuthContext.jsx              # Login/auth
│   │   └── components/
│   │       ├── marketIntel/
│   │       │   ├── MarketIntelPanel.jsx # Tab container (Consultas/Cobertura/Cargar Datos)
│   │       │   ├── QueryView.jsx        # Filter dropdowns + data display + print
│   │       │   ├── CoverageView.jsx     # Browse what's in DB (tree view)
│   │       │   ├── IngestView.jsx       # Upload PDFs/text → extract → confirm → save
│   │       │   ├── MiniChart.jsx        # Bar + line SVG charts (dark background)
│   │       │   ├── ResponseCard.jsx     # (legacy, not used in main flow anymore)
│   │       │   └── ChatView.jsx         # (legacy chat UI, kept but not mounted)
│   │       └── ... (other older components)
│   └── vite.config.js
├── backend/apps-script/
│   └── sheets-sync.gs                   # Google Apps Script code
└── BRIEFING.md                          # This file
```

---

## 5. DATABASE — SUPABASE

### Table: `market_data`
```sql
id            uuid PRIMARY KEY
pais          text NOT NULL
ciudad        text DEFAULT ''
subzona       text DEFAULT ''
sector        text NOT NULL
tipo          text DEFAULT ''
periodo       text DEFAULT ''
fecha         date
sheet_tab     text
sheet_row     integer
data          jsonb          -- all metric columns live here (flexible)
referencia    text           -- source/broker name
info_resumen  text           -- broker notes, used for complex analysis
source_type   text           -- 'google_sheets' | 'pasted_text' | 'pdf'
created_at    timestamptz
updated_at    timestamptz

UNIQUE INDEX on (pais, ciudad, subzona, sector, tipo, periodo)
```

**Key design:** All metric columns (renta_prom_m2_mes, disponibilidad, cap_rate, inventario_total_m2, absorc_neta_trim_m2, venta_prom_m2, etc.) are stored in the `data` JSONB column. `flattenRow()` in marketDataDb.js spreads them to top-level for use.

**Important:** All nullable unique key fields (ciudad, subzona, tipo, periodo) must be empty string `''`, NOT null. The DB has `DEFAULT ''` set and all nulls were updated. This was a hard-won fix after ON CONFLICT errors.

**Country normalization:** `PAIS_ALIASES` map in marketDataDb.js handles "Panama" → "Panamá", "Dominican Republic" → "Rep. Dominicana" etc. PostgreSQL ILIKE is accent-sensitive so this is required.

---

## 6. BACKEND API ENDPOINTS

All under `/api/market-data/`:

| Method | Path | What it does |
|---|---|---|
| GET | `/aggregate` | Fetch rows by filters, run JS aggregation, return structured data for display |
| GET | `/coverage` | Return full tree: `{ total, grouped: { Panamá: { Oficinas: { Ciudad: [periods] } } } }` |
| GET | `/columns` | Return JSONB column keys per sheet_tab |
| GET | `/sheet-status` | Returns `{ connected: true/false }` based on GOOGLE_APPS_SCRIPT_URL env var |
| POST | `/sync-from-sheets` | Full sync: fetch entire Google Sheet → upsert all rows to Supabase |
| POST | `/sheets-webhook` | Called by Apps Script onEdit trigger for real-time single-row sync |
| POST | `/ingest` | Claude extracts structured rows from pasted text or PDF base64 |
| POST | `/confirm` | Write human-reviewed ingest rows to Supabase |
| GET | `/export` | Download matching rows as CSV |
| GET | `/coverage` | Coverage audit grouped by pais/sector/ciudad |

**Removed endpoints (intentionally deleted):**
- `POST /query` — was Claude intent parsing + response (too expensive, replaced by /aggregate)
- `POST /analyze` — was Claude written analysis (removed, team uses Claude Projects instead)

---

## 7. KEY SERVICES

### `marketDataAggregator.js` — Pure JS, no Claude, no DB
Takes already-flattened rows from `queryMarketData()`, returns structured display data:
- `parsePeriodScore(periodo)` — "Q1-2026" → 2026.125 for sorting
- `latestBySubzona(rows)` — one row per subzona (highest period score), sorted by rent desc
- `getCityTotal(rows)` — most recent row where subzona contains "Total" or is blank
- `getTrendData(rows)` — city-total rows sorted by period for trend chart
- `buildMetricCards(row)` — 6 cards: Renta, Disponibilidad, Inventario, Absorción Neta, Cap Rate, Precio Venta
- `aggregateRows(rows)` — runs all of the above, returns `{ city_total, by_subzona, trend, metric_cards, available_periodos, subzona_count, source_count, latest_periodo }`

### `marketDataService.js` — Claude calls
Only used for PDF/text ingest now:
- `extractMarketRows(content, contentType, columnStructure)` — Claude tool_use to extract structured rows from broker PDFs/text

Previously had `parseQueryIntent`, `fillQueryResponse`, `generateAnalysis` — these are still in the file but no routes call them anymore.

### `marketDataDb.js` — Supabase
- `queryMarketData(filters)` — flexible filter query, returns flattenRow'd results
- `upsertManyRows(records)` — dedup by unique key, then upsert ONE ROW AT A TIME (not batch — avoids same-batch ON CONFLICT error)
- `flattenRow(row)` — spreads `data` JSONB to top level
- `getColumnStructure()` — scans all rows to find unique JSONB keys per sheet_tab

### `googleSheetsService.js` — Apps Script bridge
- `fetchSheetData()` — GET to Apps Script Web App URL, returns `{ tabName: [[headers],[values],...] }`
- `parseSheetData(raw)` — converts to records using `rowToRecord()`
- `rowToRecord(rowObj, tabName, sheetRow)` — maps column headers to DB fields using `normalizeKey()`. All nullable unique key fields default to `''` not `null`.
- `isSheetConnected()` — checks GOOGLE_APPS_SCRIPT_URL env var exists

---

## 8. FRONTEND — MARKET INTELLIGENCE MODULE

### Tab structure (MarketIntelPanel.jsx)
1. **Consultas** → QueryView.jsx
2. **Cobertura** → CoverageView.jsx
3. **Cargar Datos** → IngestView.jsx

### QueryView.jsx — Main data view
- Filter bar: País dropdown, Sector dropdown, Período dropdown (no subzona)
- Auto-fetches on País/Sector change via useEffect
- "Buscar" button for manual refresh / período filter
- "Imprimir / PDF" button → `window.print()` — generates clean A4 one-pager
- Results: metric cards grid, subzone table, trend line chart
- **Stale row logic:** rows where `periodo !== latest_periodo` are dimmed to 45% opacity with italic period text + note explaining the mismatch
- CSS classes: `.no-print` hides on print, `.print-only` shows only on print

### Print layout (CSS @media print)
- Hides: nav, filters, buttons, sync UI
- Shows: `.mi-print-header` (ETRA logo + market name + period), metric cards (3-col), table, chart, footer with date
- `@page { size: A4; margin: 18mm 15mm }`

### CoverageView.jsx — Data browser
- Fetches `/api/market-data/coverage` on mount
- Collapsible tree: País → Sector → Ciudad → period tags
- Filter by country name at top
- Shows total record count

### IngestView.jsx — Data upload (existing, unchanged)
- Toggle: paste text / upload PDF
- Calls `/ingest` → Claude extracts rows → shows proposed changes with diff view
- User reviews and clicks confirm → calls `/confirm` → saves to Supabase

### MiniChart.jsx — SVG charts
- `type="bar"` or `type="line"`
- Props: `{ title, labels, datasets: [{ label, values, color }] }`
- Dark navy background (`#0D1F33`) — SVG uses white/rgba colors so it needs dark bg
- X-axis: max 7 labels shown (evenly spaced), always shows first and last

---

## 9. GOOGLE SHEETS SYNC

### How it works
1. Apps Script Web App deployed as public URL (stored as `GOOGLE_APPS_SCRIPT_URL` in Railway)
2. `doGet()` returns all sheet data as JSON
3. `doPost()` handles update/append actions
4. `onEditInstallable()` fires on cell edit → POSTs to `/api/market-data/sheets-webhook`

### To set up on a new sheet
1. Open sheet → Extensions → Apps Script
2. Paste code from `backend/apps-script/sheets-sync.gs`
3. Set `BACKEND_URL` constant to Railway URL
4. Deploy as Web App (anyone, even anonymous)
5. Copy Web App URL → paste into Railway env var `GOOGLE_APPS_SCRIPT_URL`
6. Hit "Sincronizar Sheet" button in app header

### Sheet structure expected
One tab per market/sector. Headers in row 1. Columns mapped by `normalizeKey()`:
- "Renta Prom ($/m²/mes)" → `renta_prom_m2_mes`
- "Disponibilidad (%)" → `disponibilidad`
- etc. — function strips special chars, lowercases, replaces spaces with `_`

Required columns for upsert key: País, Ciudad, Subzona (or empty), Sector, Tipo (or empty), Período (or empty)

---

## 10. CSS ARCHITECTURE

Single file: `dashboard-frontend/src/index.css` (~2900 lines)

### CSS variables (light cream theme — confusingly named)
```css
--teal:  #F4F0E6   /* background — cream/beige */
--green: #A88B4F   /* accent — gold */
--white: #0D1F33   /* text — dark navy (NOT white!) */
--w60:   #3A4E5E   /* secondary text */
--w20:   rgba(13,31,51,.15)  /* muted */
--w08:   rgba(13,31,51,.08)  /* very muted */
--border: rgba(13,31,51,.22) /* borders */
```

**Warning:** `--white` = `#0D1F33` (dark navy). Use `#1a1a1a` or `#111` for text that needs to look black on the cream background. Table text uses `#1a1a1a` explicitly for this reason.

### Market Intel CSS sections (in order in file)
- `.mi-panel`, `.mi-header`, `.mi-view-toggle` — panel shell
- `.mi-sheet-sync`, `.mi-sheet-dot`, `.mi-sync-btn` — Google Sheets status bar
- `.mi-query-view`, `.mi-query-filters`, `.mi-filter-*` — filter bar
- `.mi-cards-grid`, `.mi-card`, `.mi-card-*` — metric cards
- `.mi-table-wrap`, `.mi-data-table` — subzone table
- `.mi-chart-wrap`, `.mi-chart-title`, `.mi-chart-svg` — chart container
- `.mi-row-stale`, `.mi-period-stale`, `.mi-stale-note` — stale period styling
- `.mi-coverage-*`, `.mi-cov-*` — CoverageView tree
- `.mi-search-btn`, `.mi-print-btn` — action buttons
- `.print-only`, `.no-print` — print visibility utilities
- `@media print { ... }` — full print stylesheet at bottom

---

## 11. KNOWN ISSUES / DATA PROBLEMS

### Duplicate subzonas in table
"Periferia Este" (Q1-2026) and "Periferia Este / Tocumen" (Q4-2025) are the same submarket entered under different names from different broker sources. `latestBySubzona()` treats them as separate because the names don't match exactly.
**Fix:** In the Google Sheet, standardize subzone names across all tabs/periods. Re-sync after fixing.

### Mixed periods in table
Some subzonas show Q4-2022 or Q2-2023 data because there's no newer entry with that exact subzone name. These rows are visually dimmed (45% opacity) in the UI with a note.
**Fix:** Add newer period data for those subzonas in the sheet.

### Missing Cap Rate / Precio Venta
These columns are blank for most Panama Oficinas entries — the broker reports simply don't include them.
**Fix:** Find sources that have cap rate data (typically transaction-based reports, not leasing reports).

### Chart X-axis still slightly cramped with 30+ periods
Currently shows max 7 labels. Could be improved further but is readable.

---

## 12. ARCHITECTURE DECISION LOG

| Decision | Why |
|---|---|
| JSONB `data` column for metrics | Different markets have different columns; this avoids ALTER TABLE for every new metric |
| Empty string `''` not `null` for unique key fields | PostgreSQL unique index couldn't use COALESCE expressions with Supabase upsert |
| Upsert one row at a time | Batch upsert with duplicate keys in same batch throws "cannot affect row a second time" |
| Removed Claude from query flow | ~$0.22/chat was too expensive for internal use; SQL aggregation is instant and free |
| MiniChart dark background | SVG text/grid uses rgba(255,255,255,...) — needs dark bg to be visible |
| `--white` = dark navy | App is light-cream themed; the "white" var is the text color (dark), not the background |
| Team uses Claude Projects for analysis | Better results (full context), zero cost vs Claude API, no infrastructure needed |
| Apps Script Web App (no OAuth) | Avoids Google service account setup; public URL acts as a simple HTTP bridge |

---

## 13. CURRENT STATE (2026-06-30)

**Working:**
- Google Sheets → Supabase sync (217+ rows, manual sync button + webhook trigger)
- Filter by País/Sector/Período → instant SQL results
- Metric cards, subzone table, trend chart
- Stale period visual indicators
- Print-to-PDF one-pager (browser print dialog)
- CoverageView tree showing all loaded data
- IngestView: paste text or upload PDF → Claude extracts rows → confirm to save

**Removed/Deprecated:**
- ChatView (conversational query) — kept in repo but not mounted
- /query endpoint — removed
- /analyze endpoint — removed
- Analysis section in QueryView — removed

**Planned / not built:**
- Nothing specific planned. Team uses Claude Projects for analysis.
- Data quality improvements (subzone name standardization) are a manual sheet task.

---

## 14. FULL marketDataService.js CONTENTS

This file still contains `parseQueryIntent`, `fillQueryResponse`, and `generateAnalysis` even though no routes call them anymore. They are kept in case the chat-based flow is ever restored. `extractMarketRows` is the only function actively called (by `/ingest`).

### System prompt (used for all Claude calls in this file)
```
You are a market intelligence analyst for Intus Capital, a real estate investment firm in Latin America.
You analyze real estate market data for offices, retail, and industrial sectors across Central America and the Caribbean.
CRITICAL RULE: Only work with data explicitly provided. If a metric is not in the provided rows, set missing: true.
Never infer, estimate, or blend from adjacent markets, prior periods, or training knowledge.
Every number must trace to a specific provided row.
Asset classes: Industrial, Oficinas (Office), Retail
Countries covered: Panama, Costa Rica, El Salvador, Guatemala, Dominican Republic
```

### Model constants
```javascript
const MODEL       = process.env.ANTHROPIC_MODEL       || 'claude-sonnet-4-6';
const MODEL_CHEAP = process.env.ANTHROPIC_MODEL_CHEAP || 'claude-haiku-4-5-20251001';
```

### COMPLEX_TYPES set (conditional info_resumen)
```javascript
const COMPLEX_TYPES = new Set(['due_diligence', 'red_flags', 'one_pager', 'best_entry_markets']);
```
When output_type is in COMPLEX_TYPES, `slimRows()` keeps `info_resumen`. Otherwise strips it to reduce token cost.

### normalizeKey() in googleSheetsService.js
```javascript
function normalizeKey(header) {
  return header
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
// "Renta Prom ($/m²/mes)" → "renta_prom_mes"
// "Disponibilidad (%)" → "disponibilidad"
```

---

## 15. GOOGLE APPS SCRIPT — FULL SETUP

File: `backend/apps-script/sheets-sync.gs`

Key constants to set before deploying:
```javascript
var BACKEND_URL = 'https://industry-report-production.up.railway.app';
var SKIP_TABS = ['README', 'INSTRUCTIONS', 'TEMPLATE', 'CODIGOS', 'CONFIG'];
```

Functions:
- `doGet(e)` — returns all sheet data as `{ "Tab Name": [[headers],[row1],[row2],...] }`. Skips empty rows and SKIP_TABS.
- `doPost(e)` — handles `action: 'update'` (update row by sheetRow number) and `action: 'append'` (add new row, creates tab if missing)
- `onEditInstallable(e)` — fires on cell edit, POSTs `{ tabName, sheetRow, rowData }` to `/api/market-data/sheets-webhook`. Silent fail so it never blocks the user's edit.
- `setupTrigger()` — run ONCE manually. Installs onEditInstallable as installable trigger.
- `testSync()` — manual test, shows result in alert.

### Setup steps (Spanish for reference)
1. Abrir Google Sheet → Extensiones → Apps Script
2. Borrar código existente, pegar sheets-sync.gs completo
3. Cambiar `BACKEND_URL` a la URL de Railway
4. Guardar → Ejecutar → `setupTrigger`
5. Implementar → Nueva implementación → Tipo: Aplicación web → Ejecutar como: Yo → Acceso: Cualquiera
6. Copiar URL → Pegar en Railway como `GOOGLE_APPS_SCRIPT_URL`
7. En la app, clic en "↻ Sincronizar Sheet"

---

## 16. SUPABASE SQL MIGRATION HISTORY

### Critical fix SQL (run manually in Supabase SQL editor)
This was needed after the COALESCE index broke upserts:
```sql
DROP INDEX IF EXISTS market_data_unique;

ALTER TABLE market_data ALTER COLUMN ciudad  SET DEFAULT '';
ALTER TABLE market_data ALTER COLUMN subzona SET DEFAULT '';
ALTER TABLE market_data ALTER COLUMN tipo    SET DEFAULT '';
ALTER TABLE market_data ALTER COLUMN periodo SET DEFAULT '';

UPDATE market_data SET ciudad  = COALESCE(ciudad,  '');
UPDATE market_data SET subzona = COALESCE(subzona, '');
UPDATE market_data SET tipo    = COALESCE(tipo,    '');
UPDATE market_data SET periodo = COALESCE(periodo, '');

CREATE UNIQUE INDEX market_data_unique
  ON market_data (pais, ciudad, subzona, sector, tipo, periodo);
```

---

## 17. ALL BUGS FIXED (CHRONOLOGICAL)

### Bug 1: `tendencia` column not found
`rowToRecord()` returned `tendencia` as top-level field but it's not a DB column. Fix: removed from top-level, stays in `data` JSONB.

### Bug 2: `there is no unique or exclusion constraint matching the ON CONFLICT specification`
COALESCE-based unique index can't be used by Supabase upsert's `onConflict`. Fix: ran SQL above to recreate plain index + set DEFAULT '' on nullable fields.

### Bug 3: `ON CONFLICT DO UPDATE command cannot affect row a second time`
Sheet had duplicate rows with same key. Batch upsert can't update same row twice. Fix: switched to individual row upserts in a for loop with `continue` on error.

### Bug 4: Grey dot despite correct env var
Frontend used `VITE_API_URL` but Vercel var is `VITE_API_BASE`. Fix: updated import in MarketIntelPanel.jsx.

### Bug 5: Zero rows for Panama
DB stores "Panamá" (accented), Claude returned "Panama". PostgreSQL ILIKE is accent-sensitive. Fix: `PAIS_ALIASES` map in marketDataDb.js.

### Bug 6: White report text on cream background
`.mi-report-p` had `color: rgba(255,255,255,.8)`. Fix: changed to `color: #333`.

### Bug 7: Chart X-axis unreadable (30+ overlapping labels)
Fix: MiniChart shows max 7 labels (first + last always shown, evenly spaced between).

### Bug 8: Table text appearing blue
`var(--white)` = `#0D1F33` reads as blue on cream. Fix: `.mi-data-table td` explicitly set to `color: #1a1a1a`.

### Bug 9: Filter dropdowns transparent
`rgba(255,255,255,0.05)` background invisible on cream. Fix: `background: #fff; color: #0D1F33`.

### Bug 10: Chart invisible (white SVG on white/cream)
MiniChart SVG uses white rgba colors. Fix: `.mi-chart-wrap` background changed to `#0D1F33` (dark navy).

### Bug 11: Railway "failed to authorize: failed to fetch oauth token"
Railway infrastructure issue, not code. Fix: redeploy from Railway dashboard.

---

## 18. ARCHITECTURAL EVOLUTION

### Phase 1: Basic chat module
ChatView → user types question → Claude parses intent (Sonnet) → queries Supabase → Claude builds cards/table/chart/report. Cost: ~$0.22/chat.

### Phase 2: Cost optimization
- Intent parsing switched to Haiku
- `info_resumen` stripped for simple queries (COMPLEX_TYPES set)
- Conversation thread: last 3 exchanges sent as history

### Phase 3: Hybrid filter + analysis
- ChatView replaced with QueryView (filter dropdowns → instant SQL)
- Built `marketDataAggregator.js` (pure JS, no Claude cost)
- `generateAnalysis()` button: Claude only when explicitly requested
- CoverageView added
- Cost: ~$0.02/analysis

### Phase 4: Current state
- `/query` and `/analyze` routes removed entirely
- Analysis section removed from QueryView
- Team uses Claude Projects for analysis (upload CSV, ask questions there)
- App = data management + display + print one-pager only

### Legacy files (kept in repo, not active)
- `ChatView.jsx` — not mounted
- `ResponseCard.jsx` — not used in main flow
- `parseQueryIntent()`, `fillQueryResponse()`, `generateAnalysis()` — in marketDataService.js but no routes call them

---

## 20. HOW TO RUN LOCALLY

```bash
# Backend
cd backend
npm install
# make sure .env exists with all vars
node server.js  # runs on port 3001

# Frontend
cd dashboard-frontend
npm install
# create .env.local with VITE_API_BASE=http://localhost:3001
npm run dev     # runs on port 5173
```

---

## 21. DEPLOYMENT

Both Railway and Vercel auto-deploy when `main` branch is pushed to GitHub.

**Claude Code handles all git commits and pushes.** The user should NOT be asked to run git commands — Claude does `git add`, `git commit`, `git push` directly.

Railway sometimes has infrastructure failures (not code errors). If deploy shows "failed to authorize: failed to fetch oauth token" → just trigger a redeploy from Railway dashboard.
