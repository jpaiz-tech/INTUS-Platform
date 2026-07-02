// Google Sheets bridge via Apps Script Web App.
// The Apps Script URL is set in Railway env as GOOGLE_APPS_SCRIPT_URL.
// No credentials or OAuth needed — the deployed Web App handles auth.

const SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

function available() {
  return !!SCRIPT_URL;
}

// Normalize a spreadsheet header to a clean snake_case JSONB key.
// "Renta Prom ($/m²/mes)" → "renta_prom_mes"
// "Inventario A+ (m²)"   → "inventario_a_m2"
// "Cap Rate (%)"          → "cap_rate"
// "Nuevo Indicador"       → "nuevo_indicador"
export function normalizeKey(header) {
  if (!header || typeof header !== 'string') return null;
  const cleaned = header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/m²/gi, 'm2')             // preserve m² as m2
    .replace(/\+/g, 'plus')            // A+ → Aplus (must come before general strip)
    .replace(/[^\w\s]/g, ' ')          // all other special chars → space
    .trim()
    .replace(/\s+/g, '_')              // spaces → underscores
    .toLowerCase()
    .replace(/_+/g, '_')               // collapse multiple underscores
    .replace(/^_|_$/g, '');            // trim leading/trailing underscores
  return cleaned || null;
}

// Determine sector from tab name + tipo value
export function detectSector(tabName, tipo) {
  const tab = (tabName || '').toUpperCase();
  const t   = (tipo    || '').toLowerCase();

  if (tab.includes('OFFICE') || tab.includes('OFICINA')) return 'Oficinas';

  // Retail indicators
  if (t.includes('centro comercial') || t.includes('plaza comercial') ||
      t.includes('mall') || t.includes('retail') || t.includes('strip') ||
      t.includes('power center') || t.includes('anchor')) return 'Retail';

  // Industrial indicators
  if (t.includes('galera') || t.includes('ofibodega') || t.includes('ofibodega') ||
      t.includes('manufactura') || t.includes('industrial') ||
      t.includes('logistica') || t.includes('cold') || t.includes('bodega')) return 'Industrial';

  if (tab.includes('RETAIL'))     return 'Retail';
  if (tab.includes('INDUSTRIAL')) return 'Industrial';

  return 'Industrial'; // safe default for mixed tabs
}

// Core columns that live as top-level fields — everything else → data JSONB
// NOTE: tendencia is NOT a top-level column in market_data; it lives in data JSONB
const CORE_KEYS = new Set(['pais','ciudad','subzona','sector','tipo','periodo','fecha',
                           'referencia','info_resumen']);

// Convert a raw spreadsheet row (header → value map) into a market_data record
export function rowToRecord(rawRow, tabName, sheetRowIndex) {
  const core = {};
  const data = {};

  for (const [header, value] of Object.entries(rawRow)) {
    if (!header || value === '' || value === null || value === undefined) continue;

    const key = normalizeKey(header);
    if (!key) continue;

    // Clean numeric strings: "$19.42" → 19.42, "21.20%" → 21.20
    // Core fields (pais, ciudad, periodo, etc.) are always text — don't coerce to number.
    let cleaned = value;
    if (typeof value === 'string') {
      if (CORE_KEYS.has(key)) {
        cleaned = value.trim();
      } else {
        cleaned = value.replace(/[$,%\s]/g, '');
        if (cleaned !== '' && !isNaN(Number(cleaned))) cleaned = Number(cleaned);
        else cleaned = value.trim();
      }
    }

    // Route to core or data
    if (CORE_KEYS.has(key)) {
      core[key] = cleaned;
    } else if (key === 'pais' || key === 'ciudad' || key === 'subzona' ||
               key === 'tipo' || key === 'periodo') {
      core[key] = cleaned;
    } else {
      data[key] = cleaned;
    }
  }

  // Derive sector if not explicitly in the row
  if (!core.sector) {
    core.sector = detectSector(tabName, core.tipo || '');
  }

  // Normalize date — Apps Script serializes Date cells as ISO datetime strings
  if (core.fecha && typeof core.fecha === 'string') {
    const m = core.fecha.match(/^(\d{4}-\d{2}-\d{2})/);
    core.fecha = m ? m[1] : null;
  } else if (core.fecha instanceof Date) {
    core.fecha = core.fecha.toISOString().slice(0, 10);
  } else {
    core.fecha = null;
  }

  return {
    pais:          core.pais          || null,
    ciudad:        core.ciudad        || '',
    subzona:       core.subzona       || '',
    sector:        core.sector        || 'Industrial',
    tipo:          core.tipo          || '',
    periodo:       core.periodo       || '',
    fecha:         core.fecha         || null,
    sheet_tab:     tabName,
    sheet_row:     sheetRowIndex,
    data,
    // Default '' not null — the unique index is on plain columns, and
    // NULL != NULL in SQL uniqueness checks, which would let two rows
    // missing a referencia both insert as "distinct" duplicates.
    referencia:    data.referencia    || core.referencia    || '',
    info_resumen:  data.info_resumen  || core.info_resumen  || null,
    source_type:   'sheet_sync',
  };
}

// Fetch all sheet data from the Apps Script Web App
// Returns: { tabName: [[row arrays]] }
export async function fetchSheetData() {
  if (!available()) throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000); // 55s — under Railway's 60s request limit

  let res;
  try {
    res = await fetch(SCRIPT_URL, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Apps Script GET timed out after 55s');
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Apps Script GET failed: ${res.status} — ${body.slice(0, 200)}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const body = await res.text().catch(() => '');
    throw new Error(`Apps Script returned non-JSON (${contentType}): ${body.slice(0, 300)}`);
  }

  return res.json();
}

// Parse raw sheet data (2D arrays keyed by tab name) into market_data records
export function parseSheetData(rawData) {
  const records = [];
  const skipped = [];

  for (const [tabName, rows] of Object.entries(rawData)) {
    if (!Array.isArray(rows) || rows.length < 2) continue;

    const headers = rows[0].map(h => String(h || '').trim());
    let tabParsed = 0, tabSkipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Skip empty rows
      if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

      const rawRow = {};
      headers.forEach((h, hi) => { if (h) rawRow[h] = row[hi] ?? ''; });

      const record = rowToRecord(rawRow, tabName, i + 1); // +1 because row 1 = headers
      if (record.pais && record.sector) {
        records.push(record);
        tabParsed++;
      } else {
        tabSkipped++;
        skipped.push({ tab: tabName, sheetRow: i + 1, pais: record.pais, sector: record.sector });
      }
    }

    console.log(`[market-data] parseSheetData tab "${tabName}": ${tabParsed} parsed, ${tabSkipped} skipped`);
  }

  if (skipped.length > 0) {
    console.warn(`[market-data] ${skipped.length} rows skipped (missing pais or sector):`, JSON.stringify(skipped.slice(0, 10)));
  }

  return records;
}

// Google Apps Script Web Apps return a 302 on POST requests, and Google's
// infrastructure converts POST→GET when following that redirect, so e.postData
// is always null from external servers. Workaround: encode the payload as a
// ?data= URL param and send a GET — GET redirects preserve the method.
async function postToScript(payload, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  const url = `${SCRIPT_URL}?data=${encodeURIComponent(JSON.stringify(payload))}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[market-data] Apps Script ${label} HTTP error: ${res.status}`);
      return;
    }
    const json = await res.json().catch(() => null);
    if (json && json.ok === false) {
      console.error(`[market-data] Apps Script ${label} failed: ${json.error}`);
    } else {
      console.log(`[market-data] Apps Script ${label} OK`);
    }
  } catch (err) {
    clearTimeout(timer);
    const msg = err.name === 'AbortError' ? 'timed out after 30s' : err.message;
    console.error(`[market-data] Apps Script ${label} error: ${msg}`);
  }
}

// Write a single row back to the sheet via Apps Script
export async function writeRowToSheet(tabName, sheetRow, rowData) {
  if (!available()) { console.warn('[market-data] GOOGLE_APPS_SCRIPT_URL not set — skipping write-back'); return; }
  await postToScript({ action: 'update', tabName, sheetRow, rowData }, `write-back ${tabName} row ${sheetRow}`);
}

// Append a new row to the sheet
export async function appendRowToSheet(tabName, headers, rowData) {
  if (!available()) { console.warn('[market-data] GOOGLE_APPS_SCRIPT_URL not set — skipping append'); return; }
  await postToScript({ action: 'append', tabName, headers, rowData }, `append to ${tabName}`);
}

export { available as isSheetConnected };
