import { Router } from 'express';
import { extractMarketRows } from '../services/marketDataService.js';
import { aggregateRows, aggregateByCountry } from '../services/marketDataAggregator.js';
import {
  queryMarketData, upsertManyRows, findConflicts, commitRows,
  getMarketCoverage, getColumnStructure, deleteStaleSheetRows,
  findSimilarRows, findNumericSimilarity, getSheetStyleContext,
  logIngestion, getIngestionHistory,
} from '../services/marketDataDb.js';
import { normalizeAliases } from '../services/marketDataAggregator.js';
import {
  fetchSheetData, parseSheetData, rowToRecord, isSheetConnected, appendRowToSheet,
} from '../services/googleSheetsService.js';

export const marketDataRouter = Router();

// Claude sometimes returns rows as an object keyed by sector instead of a flat array.
// This normalizes all valid structures into a flat array of row objects.
function normalizeExtractedRows(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    // Could be array of arrays (grouped by sector) — flatten one level
    const flat = raw.flatMap(item => Array.isArray(item) ? item : [item]);
    return flat.filter(r => r && typeof r === 'object' && !Array.isArray(r));
  }
  if (typeof raw === 'object') {
    // Object keyed by sector name e.g. { "Oficinas": [...], "Industrial": [...] }
    console.warn('[market-data] extracted.rows was an object, not array — flattening:', Object.keys(raw).join(', '));
    return Object.values(raw).flatMap(v => Array.isArray(v) ? v : [v])
      .filter(r => r && typeof r === 'object' && !Array.isArray(r));
  }
  return [];
}

// ── POST /api/market-data/ingest ──────────────────────────────────────────────
// Extract rows from text/PDF → check for conflicts → return proposed (no write)
marketDataRouter.post('/ingest', async (req, res) => {
  const { text, pdf_base64, source_type = 'pasted_text' } = req.body;

  const content     = source_type === 'pdf' ? pdf_base64 : text;
  const contentType = source_type === 'pdf' ? 'pdf' : 'pasted_text';

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'text or pdf_base64 is required' });
  }

  try {
    const [columnStructure, sheetStyle] = await Promise.all([
      getColumnStructure(),
      getSheetStyleContext(),
    ]);
    const extracted  = await extractMarketRows(content, contentType, columnStructure, sheetStyle);
    const rows       = normalizeExtractedRows(extracted.rows);

    if (rows.length === 0) {
      return res.json({
        proposed:           [],
        source_description: extracted.source_description || '',
        extraction_notes:   extracted.extraction_notes   || null,
        message:            'No market data rows could be extracted from this content.',
      });
    }

    const conflicts = await findConflicts(rows);

    const proposed = await Promise.all(rows.map(async (row, i) => {
      const missingCiudad = !row.ciudad || !row.ciudad.trim();
      const existing = conflicts[i];
      if (!existing) {
        // No exact match (different/missing referencia) — check for a
        // near-duplicate: same market/period with suspiciously similar
        // numbers, which usually means this is the same report re-extracted
        // with slightly different wording rather than a genuinely new broker.
        const candidates = await findSimilarRows(row);
        const similar = findNumericSimilarity(row, candidates, normalizeAliases);
        if (similar) {
          return {
            action:          'insert',
            row,
            missing_ciudad:  missingCiudad,
            possible_duplicate: true,
            similar_existing:   similar.existing,
            matched_fields:     similar.matchedFields,
          };
        }
        return { action: 'insert', row, missing_ciudad: missingCiudad };
      }

      // Build a changes map showing old vs. new values for fields that differ
      const changes = {};
      const numericFields = [
        'inventario_total','inventario_a','inventario_b','m2_construccion',
        'renta_prom','renta_a','renta_b','rango_renta_min','rango_renta_max',
        'venta_prom','absorcion_neta','absorcion_bruta','cap_rate',
        'ocupacion','disponibilidad','disponibilidad_a','disponibilidad_b',
      ];
      const textFields = ['tipo','periodo','tendencia','referencia','info_resumen'];

      for (const field of [...numericFields, ...textFields]) {
        const oldVal = existing[field];
        const newVal = row[field];
        if (newVal != null && newVal !== oldVal) {
          changes[field] = { old: oldVal, new: newVal };
        }
      }

      // Sheet rows are the source of truth — block updates from PDF/text ingest.
      // Show the diff so the intern can see what the PDF says and update the Sheet manually.
      if (existing.source_type === 'sheet_sync') {
        return {
          action:     'sheet_locked',
          row,
          missing_ciudad: missingCiudad,
          existing:   { id: existing.id, ...existing },
          existingId: existing.id,
          changes,
        };
      }

      return {
        action:     Object.keys(changes).length > 0 ? 'update' : 'no_change',
        row,
        missing_ciudad: missingCiudad,
        existing:   { id: existing.id, ...existing },
        existingId: existing.id,
        changes,
      };
    }));

    return res.json({
      proposed,
      source_description: extracted.source_description || '',
      extraction_notes:   extracted.extraction_notes   || null,
      new_columns:        extracted.new_columns        || [],
    });
  } catch (err) {
    console.error(`[market-data] ingest error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// The spreadsheet has one tab per sector: "Oficinas", "Retail", "Industrial".
// Derive the tab name from the row's sector — never create per-country tabs.
function deriveSheetTab(row) {
  const sector = (row.sector || '').trim();
  if (/oficina/i.test(sector))   return 'Oficinas';
  if (/retail/i.test(sector))    return 'Retail';
  if (/industrial/i.test(sector)) return 'Industrial';
  return 'Industrial'; // safe default, matches detectSector()
}

// ── POST /api/market-data/confirm ─────────────────────────────────────────────
// Write human-confirmed rows to Supabase, then push them to the Google Sheet.
// sheet_locked rows (source_type='sheet_sync') are never sent by the frontend,
// but are filtered here as a safety net.
marketDataRouter.post('/confirm', async (req, res) => {
  const {
    confirmed_rows, source_type, file_name, source_description, extraction_notes,
  } = req.body;

  if (!Array.isArray(confirmed_rows) || confirmed_rows.length === 0) {
    return res.status(400).json({ error: 'confirmed_rows array is required' });
  }

  // Only insert/update — skip no_change and sheet_locked rows
  const toWrite = confirmed_rows.filter(r => r.action === 'insert' || r.action === 'update');

  if (toWrite.length === 0) {
    return res.json({ results: [], message: 'No rows to write (all were no_change or sheet_locked).' });
  }

  try {
    const results = await commitRows(toWrite);

    logIngestion({
      source_type:        source_type || 'pasted_text',
      file_name,
      source_description,
      extraction_notes,
      rows_proposed:      confirmed_rows.length,
      rows_inserted:      results.filter(r => r.action === 'inserted').length,
      rows_updated:       results.filter(r => r.action === 'updated').length,
    });

    // Push each confirmed row to the Google Sheet SEQUENTIALLY — Apps Script
    // computes "next empty row" by re-reading the sheet on every request, so
    // firing these concurrently causes multiple rows to race for the same
    // target row and all but one write gets overwritten.
    // Sheet-synced rows are excluded above, so we only push PDF/pasted_text rows.
    // Skip rows with an unresolved pais (e.g. "<UNKNOWN>") — don't pollute the sheet.
    if (isSheetConnected()) {
      for (const item of toWrite) {
        const pais = (item.row.pais || '').trim();
        if (!pais || pais === '<UNKNOWN>') {
          console.warn(`[market-data] skipping sheet write-back — unresolved pais: "${pais}"`);
          continue;
        }
        const tabName = item.existing?.sheet_tab || deriveSheetTab(item.row);
        try {
          await appendRowToSheet(tabName, null, item.row);
        } catch (err) {
          console.error(`[market-data] sheet write-back failed (${tabName}): ${err.message}`);
        }
      }
    }

    return res.json({ results });
  } catch (err) {
    console.error(`[market-data] confirm error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/coverage ─────────────────────────────────────────────
// Coverage audit — which markets have data loaded
marketDataRouter.get('/coverage', async (req, res) => {
  try {
    const rows = await getMarketCoverage();

    // Group by pais → sector → ciudad
    const grouped = {};
    for (const row of rows) {
      const p = row.pais   || 'Desconocido';
      const s = row.sector || 'Desconocido';
      const c = row.ciudad || 'Sin ciudad';
      if (!grouped[p])    grouped[p]    = {};
      if (!grouped[p][s]) grouped[p][s] = {};
      if (!grouped[p][s][c]) grouped[p][s][c] = [];
      grouped[p][s][c].push(row.periodo);
    }

    return res.json({ total: rows.length, grouped });
  } catch (err) {
    console.error(`[market-data] coverage error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/history ──────────────────────────────────────────────
// History of confirmed PDF/pasted-text uploads — for the Historial tab.
marketDataRouter.get('/history', async (_req, res) => {
  try {
    const ingestions = await getIngestionHistory();
    return res.json({ ingestions });
  } catch (err) {
    console.error(`[market-data] history error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/export ───────────────────────────────────────────────
// Return matching rows as CSV download
marketDataRouter.get('/export', async (req, res) => {
  const filters = {
    pais:    req.query.pais    || undefined,
    ciudad:  req.query.ciudad  || undefined,
    sector:  req.query.sector  || undefined,
    periodo: req.query.periodo || undefined,
  };

  try {
    const rows = await queryMarketData(filters);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No rows matching these filters' });
    }

    const csv = toCSV(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="market-data-export.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error(`[market-data] export error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/columns ──────────────────────────────────────────────
// Returns current JSONB column structure keyed by sheet_tab
marketDataRouter.get('/columns', async (_req, res) => {
  try {
    const structure = await getColumnStructure();
    return res.json({ structure });
  } catch (err) {
    console.error(`[market-data] columns error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/sheet-status ─────────────────────────────────────────
// Is the Apps Script URL configured?
marketDataRouter.get('/sheet-status', (_req, res) => {
  return res.json({ connected: isSheetConnected() });
});

// ── POST /api/market-data/test-sheet-write ────────────────────────────────────
// Debug: attempt a real append to the sheet and return the raw result.
// Body: { tabName?, rowData? } — defaults to a dummy row on "Industrial".
marketDataRouter.post('/test-sheet-write', async (req, res) => {
  if (!isSheetConnected()) {
    return res.status(503).json({ error: 'GOOGLE_APPS_SCRIPT_URL not configured' });
  }
  const tabName = req.body.tabName || 'Industrial';
  const rowData = req.body.rowData || { pais: 'TEST', ciudad: 'TEST', sector: 'Industrial', periodo: 'TEST' };
  try {
    await appendRowToSheet(tabName, null, rowData);
    return res.json({ ok: true, message: `append attempted to tab "${tabName}" — check Railway logs for result` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});


// ── POST /api/market-data/sync-from-sheets ─────────────────────────────────────
// Full sync: read entire Google Sheet → upsert all rows into Supabase.
// Sheet is the source of truth for this direction.
marketDataRouter.post('/sync-from-sheets', async (_req, res) => {
  if (!isSheetConnected()) {
    return res.status(503).json({ error: 'GOOGLE_APPS_SCRIPT_URL not configured in Railway env vars' });
  }

  try {
    console.log('[market-data] Starting full sheet sync...');

    const rawData = await fetchSheetData();
    const records = parseSheetData(rawData);

    if (records.length === 0) {
      return res.json({ message: 'No rows found in sheet', upserted: 0 });
    }

    const { results, dupeKeys, errors } = await upsertManyRows(records);

    // Remove sheet_sync rows whose IDs weren't returned by this sync — deleted from sheet.
    // If results is empty (all upserts failed), skip deletion so we don't wipe the DB.
    const upsertedIds = results.map(r => r.id).filter(Boolean);
    const deleted = await deleteStaleSheetRows(upsertedIds);

    console.log(`[market-data] Sheet sync done: ${results.length} upserted, ${deleted} deleted, ${dupeKeys.length} dupes, ${errors.length} errors`);
    return res.json({
      upserted: results.length,
      deleted,
      total_in_sheet: records.length,
      dupe_count: dupeKeys.length,
      dupe_keys: dupeKeys,
      error_count: errors.length,
      errors,
    });
  } catch (err) {
    console.error(`[market-data] sync-from-sheets error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/market-data/sheets-webhook ──────────────────────────────────────
// Called by the Apps Script onEdit trigger whenever a row changes.
// Body: { tabName, sheetRow, rowData: { "Header Name": value, ... } }
marketDataRouter.post('/sheets-webhook', async (req, res) => {
  const { tabName, sheetRow, rowData } = req.body || {};
  if (!tabName || !rowData) {
    return res.status(400).json({ error: 'tabName and rowData required' });
  }

  try {
    const record = rowToRecord(rowData, tabName, sheetRow);
    if (!record.pais || !record.sector) {
      return res.status(400).json({ error: 'Row missing pais or sector — skipped' });
    }
    const { errors } = await upsertManyRows([record]);
    if (errors.length) {
      return res.status(500).json({ error: errors[0].message });
    }
    console.log(`[market-data] Webhook: upserted 1 row from ${tabName} row ${sheetRow}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error(`[market-data] sheets-webhook error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/regional ────────────────────────────────────────────
// One summary row per country for a given sector — used by the Comparativo tab.
marketDataRouter.get('/regional', async (req, res) => {
  const { sector } = req.query;
  const filters = {};
  if (sector) filters.sector = sector;

  try {
    const rows      = await queryMarketData(filters);
    const countries = aggregateByCountry(rows);
    return res.json({ ok: true, sector: sector || null, countries });
  } catch (err) {
    console.error(`[market-data] regional error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/market-data/aggregate ───────────────────────────────────────────
// Fetch rows matching optional filters, then aggregate them for display.
marketDataRouter.get('/aggregate', async (req, res) => {
  const filters = {
    pais:    req.query.pais    || undefined,
    sector:  req.query.sector  || undefined,
    ciudad:  req.query.ciudad  || undefined,
    subzona: req.query.subzona || undefined,
    periodo: req.query.periodo || undefined,
  };

  // Remove undefined keys so queryMarketData isn't confused by them
  Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);

  try {
    const rows       = await queryMarketData(filters);
    const aggregated = aggregateRows(rows);

    return res.json({
      ok:         true,
      filters,
      rows_found: rows.length,
      ...aggregated,
    });
  } catch (err) {
    console.error(`[market-data] aggregate error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = v => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}
