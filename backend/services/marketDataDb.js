import supabase from '../utils/supabaseClient.js';

// Flatten a market_data row for display: spread data JSONB into the top level
export function flattenRow(row) {
  const { data, ...core } = row;
  return { ...core, ...(data || {}) };
}

// Actual top-level columns in the market_data table — everything else goes in data JSONB
const CORE_DB_COLS = new Set([
  'pais', 'ciudad', 'subzona', 'sector', 'tipo', 'periodo', 'fecha',
  'sheet_tab', 'sheet_row', 'source_type', 'referencia', 'info_resumen',
]);

// Pack a flat extracted row into { core columns... , data: { metric fields... } }
// so it can be safely upserted without hitting unknown-column errors.
function packRow(row) {
  const core = {};
  const extra = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'data') {
      Object.assign(extra, v || {});  // merge existing data JSONB
    } else if (CORE_DB_COLS.has(k)) {
      core[k] = v;
    } else {
      extra[k] = v;
    }
  }
  // Default '' not null — the unique index is on plain columns, and
  // NULL != NULL in SQL uniqueness checks, which would let two rows
  // missing these fields both insert as "distinct" duplicates instead
  // of being treated as the same market/period (e.g. two country-level
  // time series rows with no ciudad would never dedupe against each other).
  core.referencia = core.referencia || '';
  core.ciudad     = core.ciudad     || '';
  core.subzona    = core.subzona    || '';
  core.tipo       = core.tipo       || '';
  core.periodo    = core.periodo    || '';

  return { ...core, data: Object.keys(extra).length ? extra : {} };
}

// Normalize country names to match DB values (handles missing accents from Claude)
const PAIS_ALIASES = {
  'panama': 'Panamá', 'panamá': 'Panamá',
  'costa rica': 'Costa Rica',
  'dominican republic': 'Rep. Dominicana', 'republica dominicana': 'Rep. Dominicana',
  'rep dominicana': 'Rep. Dominicana', 'rep. dominicana': 'Rep. Dominicana',
  'el salvador': 'El Salvador',
  'guatemala': 'Guatemala',
  'honduras': 'Honduras', 'nicaragua': 'Nicaragua',
};
function normalizePais(val) {
  if (!val) return val;
  return PAIS_ALIASES[val.toLowerCase().trim()] || val;
}

// Query market_data with flexible filters
export async function queryMarketData(filters = {}) {
  if (!supabase) return [];

  let q = supabase.from('market_data').select('*');

  if (filters.pais)    q = q.ilike('pais',    `%${normalizePais(filters.pais)}%`);
  if (filters.ciudad)  q = q.ilike('ciudad',  `%${filters.ciudad}%`);
  if (filters.subzona) q = q.ilike('subzona', `%${filters.subzona}%`);
  if (filters.sector)  q = q.ilike('sector',  `%${filters.sector}%`);
  if (filters.tipo)    q = q.ilike('tipo',    `%${filters.tipo}%`);
  if (filters.periodo) q = q.ilike('periodo', `%${filters.periodo}%`);

  q = q.order('fecha', { ascending: false, nullsFirst: false }).limit(200);

  const { data, error } = await q;
  if (error) throw new Error(`market_data query: ${error.message}`);
  return (data || []).map(flattenRow);
}

// Upsert a single record (insert or update based on unique key)
export async function upsertMarketRow(record) {
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('market_data')
    .upsert({ ...record, updated_at: now }, {
      onConflict: 'pais,ciudad,subzona,sector,tipo,periodo,referencia',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw new Error(`upsert market_data: ${error.message}`);
  return data;
}

// Same 6-field key as the unique index, plus referencia — different broker
// reports for the same market/period are distinct rows, not the same row.
function uniqueKey(r) {
  return `${r.pais}|${r.ciudad||''}|${r.subzona||''}|${r.sector}|${r.tipo||''}|${r.periodo||''}|${r.referencia||''}`;
}

// Bulk upsert — used for sheet sync and batch ingest
export async function upsertManyRows(records) {
  if (!supabase) throw new Error('Supabase not configured');
  if (!records.length) return { results: [], dupes: [], errors: [] };

  // Deduplicate by unique key — last row wins (most recent in sheet)
  const seen = new Map();
  const dupeKeys = [];
  for (const r of records) {
    const key = uniqueKey(r);
    if (seen.has(key)) dupeKeys.push(key);
    seen.set(key, r);
  }
  const deduped = [...seen.values()];

  // Upsert one row at a time — avoids same-batch conflict errors
  const results = [];
  const errors  = [];
  for (const r of deduped) {
    const { data, error } = await supabase
      .from('market_data')
      .upsert(r, { onConflict: 'pais,ciudad,subzona,sector,tipo,periodo,referencia', ignoreDuplicates: false })
      .select()
      .single();
    if (error) {
      console.warn(`[market-data] skipping row (${r.pais}/${r.sector}): ${error.message}`);
      errors.push({ key: uniqueKey(r), message: error.message });
      continue;
    }
    if (data) results.push(data);
  }

  // If every row failed, throw so the caller sees the real Supabase error
  if (results.length === 0 && errors.length > 0) {
    throw new Error(`All ${errors.length} upserts failed. First error: ${errors[0].message}`);
  }

  if (dupeKeys.length || errors.length) {
    console.log(`[market-data] upsertManyRows: ${records.length} in, ${dupeKeys.length} dupe keys collapsed, ${errors.length} errors, ${results.length} succeeded`);
    if (dupeKeys.length) console.log('[market-data] dupe keys:', dupeKeys);
    if (errors.length) console.log('[market-data] errors:', JSON.stringify(errors));
  }

  return { results, dupeKeys, errors };
}

// Check which proposed rows already exist in Supabase
export async function findConflicts(proposedRows) {
  if (!supabase) return proposedRows.map(() => null);

  return Promise.all(proposedRows.map(async row => {
    if (!row.pais || !row.sector) return null;

    let q = supabase.from('market_data').select('*')
      .ilike('pais',   row.pais)
      .ilike('sector', row.sector);

    if (row.ciudad)     q = q.ilike('ciudad',     row.ciudad);
    if (row.subzona)    q = q.ilike('subzona',    row.subzona);
    if (row.tipo)       q = q.ilike('tipo',       row.tipo);
    if (row.periodo)    q = q.eq('periodo',       row.periodo);
    // Different brokers reporting the same market/period are distinct rows,
    // not conflicts — only match an existing row from the SAME source.
    if (row.referencia) q = q.ilike('referencia', row.referencia);

    const { data } = await q.limit(1).maybeSingle();
    return data || null;
  }));
}

// Fields compared for the near-duplicate heuristic. Names match the canonical
// keys normalizeAliases() resolves to, so PDF-extracted rows (renta_prom,
// absorcion_neta, etc.) and sheet-synced rows (renta_prom_m2_mes, etc.)
// compare on equal footing.
const SIMILARITY_FIELDS = ['renta_prom_m2_mes', 'disponibilidad', 'inventario_total_m2', 'absorc_neta_trim_m2', 'cap_rate'];

// For a proposed row with no exact conflict (different/missing referencia),
// find existing rows on the same market/period from ANY source — used to warn
// when a "new" row's numbers are suspiciously close to something on file,
// which usually means it's the same report re-extracted with slightly
// different wording rather than a genuinely new broker.
export async function findSimilarRows(row) {
  if (!supabase || !row.pais || !row.sector) return [];

  let q = supabase.from('market_data').select('*')
    .ilike('pais',   row.pais)
    .ilike('sector', row.sector);
  if (row.ciudad)  q = q.ilike('ciudad',  row.ciudad);
  if (row.subzona) q = q.ilike('subzona', row.subzona);
  if (row.periodo) q = q.eq('periodo',    row.periodo);

  const { data } = await q.limit(10);
  return (data || []).map(flattenRow);
}

// Returns { existing, matchedFields } for the closest near-duplicate candidate,
// or null. Requires 2+ numeric fields within 2% of each other to flag a match —
// a single coincidental match isn't strong enough evidence.
export function findNumericSimilarity(row, candidates, normalizeAliases) {
  const normRow = normalizeAliases({ ...row });
  let best = null;

  for (const candidate of candidates) {
    if (row.referencia && candidate.referencia &&
        row.referencia.trim().toLowerCase() === candidate.referencia.trim().toLowerCase()) {
      continue; // same source — already handled as an exact conflict elsewhere
    }

    const normCandidate = normalizeAliases({ ...candidate });
    const matched = [];
    for (const field of SIMILARITY_FIELDS) {
      const a = normRow[field], b = normCandidate[field];
      if (typeof a !== 'number' || typeof b !== 'number') continue;
      if (a === 0 || b === 0) continue; // zeros mean "data missing" not "same value"
      const relDiff = Math.abs(a - b) / Math.abs(b);
      if (relDiff <= 0.02) matched.push(field);
    }
    if (matched.length >= 2 && (!best || matched.length > best.matchedFields.length)) {
      best = { existing: candidate, matchedFields: matched };
    }
  }

  return best;
}

// Commit human-reviewed rows (insert or update)
export async function commitRows(confirmedRows) {
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();
  const results = [];

  for (const { action, row, existingId } of confirmedRows) {
    const packed = packRow(row);
    if (action === 'update' && existingId) {
      const { data, error } = await supabase
        .from('market_data')
        .update(packed)
        .eq('id', existingId)
        .select().single();
      if (error) throw new Error(`update market_data (${existingId}): ${error.message}`);
      results.push({ action: 'updated', row: flattenRow(data) });
    } else {
      const { data, error } = await supabase
        .from('market_data')
        .insert({ ...packed, source_type: packed.source_type || 'pasted_text' })
        .select().single();
      if (error) throw new Error(`insert market_data: ${error.message}`);
      results.push({ action: 'inserted', row: flattenRow(data) });
    }
  }

  console.log(`[market-data] committed ${results.length} rows`);
  return results;
}

// Coverage audit — all unique market combinations
export async function getMarketCoverage() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('market_data')
    .select('pais, ciudad, sector, tipo, periodo, referencia, source_type, created_at, updated_at')
    .order('pais').order('sector')
    .order('fecha', { ascending: false, nullsFirst: false });

  if (error) throw new Error(`coverage query: ${error.message}`);
  return data || [];
}

// Sample real values already in the sheet for every identity field — used as
// few-shot style examples during extraction so Claude matches the sheet's
// existing vocabulary and formats (e.g. "Ciudad de Panamá" not "Panama City",
// periodo "2026-Q1" not "Q1-2026") instead of inventing its own per document.
export async function getSheetStyleContext(limitPerField = 15) {
  const empty = { ciudades: [], subzonas: [], tipos: [], periodos: [], referencias: [] };
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from('market_data')
    .select('ciudad, subzona, tipo, periodo, referencia')
    .eq('source_type', 'sheet_sync')
    .limit(400);

  if (error) throw new Error(`sheet style samples query: ${error.message}`);

  // Count frequency so the most common (canonical) spellings rank first
  function topValues(field) {
    const counts = new Map();
    for (const row of (data || [])) {
      const v = (row[field] || '').trim();
      if (!v) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitPerField)
      .map(([v]) => v);
  }

  return {
    ciudades:    topValues('ciudad'),
    subzonas:    topValues('subzona'),
    tipos:       topValues('tipo'),
    periodos:    topValues('periodo'),
    referencias: topValues('referencia'),
  };
}

// Return all unique JSONB keys across all rows — lets Claude know what columns exist
export async function getColumnStructure() {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('market_data')
    .select('sheet_tab, data')
    .limit(500);

  if (error) throw new Error(`column structure query: ${error.message}`);

  // Collect unique keys per sector/tab
  const byTab = {};
  for (const row of (data || [])) {
    const tab = row.sheet_tab || 'unknown';
    if (!byTab[tab]) byTab[tab] = new Set();
    for (const key of Object.keys(row.data || {})) {
      byTab[tab].add(key);
    }
  }

  // Convert Sets to arrays
  const result = {};
  for (const [tab, keys] of Object.entries(byTab)) {
    result[tab] = [...keys].sort();
  }
  return result;
}

// Delete sheet_sync rows whose IDs were NOT returned by the latest sync upsert.
// Those rows existed in the DB but are no longer in the sheet — they were deleted.
// Safety: if upsertedIds is empty (all upserts failed), we delete nothing.
export async function deleteStaleSheetRows(upsertedIds) {
  if (!supabase) throw new Error('Supabase not configured');
  if (!upsertedIds || !upsertedIds.length) return 0;

  const { data, error } = await supabase
    .from('market_data')
    .delete()
    .eq('source_type', 'sheet_sync')
    .not('id', 'in', `(${upsertedIds.join(',')})`)
    .select('id');

  if (error) throw new Error(`delete stale sheet rows: ${error.message}`);
  return (data || []).length;
}

// Export rows as CSV
export async function exportMarketData(filters = {}) {
  const rows = await queryMarketData(filters);
  return rows;
}
