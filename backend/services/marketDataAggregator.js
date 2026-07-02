/**
 * marketDataAggregator.js
 *
 * Pure JS aggregation logic for already-flattened market_data rows.
 * No Claude calls. No DB calls. Input is the output of queryMarketData().
 */

// ── parsePeriodScore ──────────────────────────────────────────────────────────
/**
 * Converts a period string into a sortable float so rows can be ranked
 * chronologically.
 *
 * Examples:
 *   "Q1-2026" → 2026.125   "Q4 2025" → 2025.875
 *   "Q2 2023" → 2023.375   "Q3 2024" → 2024.625
 *   "2025"    → 2025.0
 *   "1H-2025" / "1S 2025" → 2025.125
 *   "2H-2024" / "2S 2024" → 2024.625
 *   null / unknown         → 0
 */
export function parsePeriodScore(periodo) {
  if (periodo == null || periodo === '') return 0;
  // Accept numbers (e.g. GAS returns plain year cells as 2019, not "2019")
  const s = String(periodo).trim();
  if (!s) return 0;

  // Quarter — both orderings:
  //   Qn-YYYY / Qn YYYY  (e.g. Q1-2026, Q4 2025)
  //   YYYY-Qn / YYYY Qn  (e.g. 2026-Q1, 2022-Q4) ← sheet standard
  const qA = s.match(/^Q([1-4])[\s\-](\d{4})/i);
  if (qA) return parseInt(qA[2], 10) + (parseInt(qA[1], 10) * 2 - 1) * 0.125;

  const qB = s.match(/^(\d{4})[\s\-]Q([1-4])/i);
  if (qB) return parseInt(qB[1], 10) + (parseInt(qB[2], 10) * 2 - 1) * 0.125;

  // Spanish quarter nT — both orderings:
  //   YYYY-nT (e.g. 2024-3T, 2024-3T Proyección)
  const tA = s.match(/^(\d{4})[\s\-]([1-4])[T]/i);
  if (tA) return parseInt(tA[1], 10) + (parseInt(tA[2], 10) * 2 - 1) * 0.125;

  // Half-year — both orderings:
  //   nH/nS-YYYY  (e.g. 1H-2025, 2S 2024)
  //   YYYY-nH/nS  (e.g. 2025-1H, 2024-2S) ← sheet standard
  const hA = s.match(/^([12])[HS][\s\-](\d{4})/i);
  if (hA) return parseInt(hA[2], 10) + (parseInt(hA[1], 10) === 1 ? 0.125 : 0.625);

  const hB = s.match(/^(\d{4})[\s\-]([12])[HS]/i);
  if (hB) return parseInt(hB[1], 10) + (parseInt(hB[2], 10) === 1 ? 0.125 : 0.625);

  // Plain year — also catches "Encuesta 2024", "Reporte 2023", etc.
  const yearMatch = s.match(/(\d{4})/);
  if (yearMatch) return parseFloat(yearMatch[1]);

  return 0;
}

// ── Field alias normalization ─────────────────────────────────────────────────
// Sheet column headers normalize to different snake_case keys depending on
// how brokers name them. This maps every known variant to the canonical key
// used everywhere else in this file.
const FIELD_ALIASES = {
  absorc_neta_trim_m2: ['absorc_neta_m2', 'absorcion_neta_trim_m2', 'absorcion_neta_m2', 'absorcion_neta', 'abs_neta_m2', 'abs_neta', 'absorcion_bruta'],
  renta_prom_m2_mes:   ['renta_prom_mes', 'renta_prom', 'renta_promedio', 'renta_promedio_m2_mes'],
  inventario_total_m2: ['inventario_total', 'inventario_m2', 'inventario'],
  disponibilidad:      ['disponibilidad_pct', 'tasa_disponibilidad', 'vacancia'],
  m2_construccion:     ['metros_de_construccion', 'construccion_m2', 'm2_en_construccion'],
};

export function normalizeAliases(row) {
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (row[canonical] != null) continue; // already has the canonical key
    for (const alias of aliases) {
      if (row[alias] != null) { row[canonical] = row[alias]; break; }
    }
  }
  return row;
}

// ── Metrics that support range display ───────────────────────────────────────
const RANGE_METRICS = [
  'renta_prom_m2_mes',
  'disponibilidad',
  'inventario_total_m2',
  'absorc_neta_trim_m2',
  'cap_rate',
  'm2_construccion',
];

// ── _rangeFields ─────────────────────────────────────────────────────────────
/**
 * Given an array of rows, compute min/max for each RANGE_METRIC.
 * Returns an object of { metric_min, metric_max } for metrics with 2+ values,
 * plus _rowCount.
 */
function _rangeFields(subRows) {
  const extra = { _rowCount: subRows.length };
  for (const metric of RANGE_METRICS) {
    const vals = subRows.map(r => r[metric]).filter(v => v != null && typeof v === 'number');
    if (vals.length >= 2) {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      if (min !== max) {
        extra[`${metric}_min`] = min;
        extra[`${metric}_max`] = max;
      }
    }
  }
  return extra;
}

// ── latestBySubzona ───────────────────────────────────────────────────────────
/**
 * For each unique subzona key, collects ALL rows at the highest period score
 * (different tipos may coexist for the same subzona+period).
 *
 * The returned row is the base row with the highest renta, augmented with
 * {metric}_min / {metric}_max fields when multiple rows exist in the group.
 *
 * Rows whose subzona contains "Total" or "Histórico" are excluded.
 *
 * Returns array sorted by renta_prom_m2_mes descending (nulls last).
 */
export function latestBySubzona(rows) {
  const exclude = /\btotal\b|\bhist[oó]rico\b/i;

  // 1. Find the best period score per subzona key
  const bestScore = new Map();
  for (const row of rows) {
    const sz = row.subzona || '';
    if (exclude.test(sz)) continue;
    const key   = sz.trim() || (row.ciudad || '').trim() || '__unknown__';
    const score = parsePeriodScore(row.periodo);
    if (!bestScore.has(key) || score > bestScore.get(key)) bestScore.set(key, score);
  }

  // 2. Group all rows that sit at their subzona's best period
  const groups = new Map();
  for (const row of rows) {
    const sz = row.subzona || '';
    if (exclude.test(sz)) continue;
    const key = sz.trim() || (row.ciudad || '').trim() || '__unknown__';
    if (parsePeriodScore(row.periodo) === bestScore.get(key)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }

  // 3. For each group, pick the highest-renta row as the base and annotate ranges
  return [...groups.values()].map(subRows => {
    const base = [...subRows].sort((a, b) =>
      (b.renta_prom_m2_mes ?? -Infinity) - (a.renta_prom_m2_mes ?? -Infinity)
    )[0];
    return { ...base, ..._rangeFields(subRows) };
  }).sort((a, b) => {
    const ra = a.renta_prom_m2_mes ?? null;
    const rb = b.renta_prom_m2_mes ?? null;
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return rb - ra;
  });
}

// ── getCityTotal ──────────────────────────────────────────────────────────────
/**
 * Find the most-recent "city total" row — i.e. where subzona is empty, null,
 * or contains "Total" (case-insensitive).  If multiple rows match (different
 * periods), return the one with the highest parsePeriodScore.
 *
 * Returns a single row object or null.
 */
export function getCityTotal(rows) {
  const isTotalRow = row => {
    const sz = (row.subzona || '').trim();
    return sz === '' || /total/i.test(sz);
  };

  const candidates = rows.filter(isTotalRow);
  if (!candidates.length) return null;

  return candidates.reduce((best, row) =>
    parsePeriodScore(row.periodo) >= parsePeriodScore(best.periodo) ? row : best
  );
}

// ── getCityTotalRows ──────────────────────────────────────────────────────────
/**
 * Returns ALL city-total rows (subzona empty or "Total") that share the most
 * recent period.  Used to compute ranges across multiple broker reports that
 * all reference the same period but may have different values.
 */
export function getCityTotalRows(rows) {
  const isTotalRow = row => {
    const sz = (row.subzona || '').trim();
    return sz === '' || /total/i.test(sz);
  };

  const totalRows = rows.filter(isTotalRow);
  if (!totalRows.length) return [];

  const bestScore = Math.max(...totalRows.map(r => parsePeriodScore(r.periodo)));
  return totalRows.filter(r => parsePeriodScore(r.periodo) === bestScore);
}

// ── getTrendData ──────────────────────────────────────────────────────────────
/**
 * Extract trend series from city-level / total rows only (subzona empty or
 * contains "Total"), grouped by period so multiple reports for the same period
 * produce a min/max range at each point.
 *
 * Returns array sorted chronologically ascending.  Each point includes:
 *   periodo, renta_prom_m2_mes, disponibilidad, absorc_neta_trim_m2, inventario_total_m2
 *   and optional *_min / *_max fields when the period has 2+ rows.
 */
export function getTrendData(rows) {
  const isTotalRow = row => {
    const sz = (row.subzona || '').trim();
    return sz === '' || /total/i.test(sz);
  };

  const totalRows = rows.filter(isTotalRow);

  // Group by period
  const byPeriod = new Map();
  for (const row of totalRows) {
    const p = row.periodo ?? '';
    if (!byPeriod.has(p)) byPeriod.set(p, []);
    byPeriod.get(p).push(row);
  }

  const TREND_METRICS = ['renta_prom_m2_mes', 'disponibilidad', 'absorc_neta_trim_m2', 'inventario_total_m2'];

  return [...byPeriod.entries()]
    .sort(([a], [b]) => parsePeriodScore(a) - parsePeriodScore(b))
    .map(([periodo, periodRows]) => {
      const point = { periodo };
      for (const metric of TREND_METRICS) {
        const vals = periodRows.map(r => r[metric]).filter(v => v != null && typeof v === 'number');
        if (vals.length === 0) {
          point[metric] = null;
        } else if (vals.length === 1) {
          point[metric] = vals[0];
        } else {
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          point[metric] = (min + max) / 2; // midpoint for the line
          if (min !== max) {
            point[`${metric}_min`] = min;
            point[`${metric}_max`] = max;
          }
        }
      }
      return point;
    });
}

// ── getAvailablePeriodos ──────────────────────────────────────────────────────
/**
 * Returns a deduplicated array of periodo strings, ordered most-recent first.
 */
export function getAvailablePeriodos(rows) {
  const unique = [...new Set(rows.map(r => r.periodo).filter(Boolean))];
  return unique.sort((a, b) => parsePeriodScore(b) - parsePeriodScore(a));
}

// ── buildMetricCards ──────────────────────────────────────────────────────────
/**
 * Build an array of display-ready metric card objects from one or more rows.
 *
 * When multiple rows are provided (e.g. different broker reports or tipos for
 * the same period), min/max is computed across all of them and the card shows
 * a range when the values differ.
 *
 * Each card: { label, value, unit, missing, period, hasRange, rawMin, rawMax }
 */
// primaryRows: city-total rows (preferred source for headline metrics).
// fallbackRows: all subzone rows — used when a metric has no value in primaryRows.
// This ensures cards are filled with whatever data is available for the query.
export function buildMetricCards(primaryRows, fallbackRows = []) {
  const primary  = Array.isArray(primaryRows)  ? primaryRows  : (primaryRows  ? [primaryRows]  : []);
  const fallback = Array.isArray(fallbackRows) ? fallbackRows : (fallbackRows ? [fallbackRows] : []);

  if (primary.length === 0 && fallback.length === 0) {
    return _cardDefs().map(def => ({ label: def.label, value: null, unit: def.unit, missing: true, period: null }));
  }

  const period = (primary[0] || fallback[0])?.periodo ?? null;

  return _cardDefs().map(def => {
    // Text cards (tendencia etc.) — just pick first non-null value across all rows
    if (def.type === 'text') {
      const val = [...primary, ...fallback].map(r => r[def.key]).find(v => v != null && v !== '');
      if (!val) return { label: def.label, value: null, unit: def.unit, missing: true, period };
      return { label: def.label, value: String(val), unit: def.unit, missing: false, hasRange: false, period };
    }

    // Phase 1: try city-total rows
    let vals = primary.map(r => r[def.key]).filter(v => v != null && typeof v === 'number');
    // Phase 2: if no value found, scan all rows (subzones, etc.)
    if (vals.length === 0) {
      vals = [...primary, ...fallback].map(r => r[def.key]).filter(v => v != null && typeof v === 'number');
    }

    if (vals.length === 0) {
      return { label: def.label, value: null, unit: def.unit, missing: true, period };
    }

    const min      = Math.min(...vals);
    const max      = Math.max(...vals);
    const hasRange = min !== max;

    return {
      label:    def.label,
      value:    hasRange ? `${def.format(min)}–${def.format(max)}` : def.format(min),
      rawMin:   min,
      rawMax:   max,
      unit:     def.unit,
      missing:  false,
      hasRange,
      period,
      count:    vals.length,
    };
  });
}

/** Internal card definitions — keeps buildMetricCards clean. */
function _cardDefs() {
  const pct = v => {
    const n = v < 1 ? v * 100 : v;
    return `${n.toFixed(1)}%`;
  };
  const thousands = v =>
    Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const signed = v => {
    const n = Number(v);
    return (n >= 0 ? '+' : '') + thousands(n);
  };

  return [
    {
      key:    'renta_prom_m2_mes',
      label:  'Renta Promedio',
      unit:   'USD/m²/mes',
      format: v => Number(v).toFixed(2),
    },
    {
      key:    'disponibilidad',
      label:  'Disponibilidad',
      unit:   '%',
      format: pct,
    },
    {
      key:    'inventario_total_m2',
      label:  'Inventario Total',
      unit:   'm²',
      format: thousands,
    },
    {
      key:    'absorc_neta_trim_m2',
      label:  'Absorción Neta',
      unit:   'm²',
      format: signed,
    },
    {
      key:    'cap_rate',
      label:  'Cap Rate',
      unit:   '%',
      format: pct,
    },
    {
      key:    'm2_construccion',
      label:  'M² en Construcción',
      unit:   'm²',
      format: thousands,
    },
    {
      key:    'tendencia',
      label:  'Tendencia',
      unit:   '',
      type:   'text',
      format: v => String(v),
    },
  ];
}

// ── aggregateByCountry ────────────────────────────────────────────────────────
/**
 * Groups rows by pais and returns one summary object per country, using the
 * latest city-total row for headline metrics.  Used by the /regional endpoint.
 *
 * @param {object[]} rows - Flattened rows from queryMarketData()
 * @returns {object[]} Sorted by renta descending (nulls last), then alphabetically.
 */
export function aggregateByCountry(rows) {
  if (!Array.isArray(rows)) rows = [];
  rows = rows.map(normalizeAliases);

  const byPais = {};
  for (const row of rows) {
    const p = row.pais || 'Desconocido';
    if (!byPais[p]) byPais[p] = [];
    byPais[p].push(row);
  }

  const results = Object.entries(byPais).map(([pais, paisRows]) => {
    const cityTotalRows = getCityTotalRows(paisRows);
    const bySubzona     = latestBySubzona(paisRows);
    const periodos      = getAvailablePeriodos(paisRows);
    // Use city-total rows for metrics; fall back to subzone rows
    const metricRows    = cityTotalRows.length > 0 ? cityTotalRows : bySubzona;

    const num = k => metricRows.map(r => r[k]).filter(v => v != null && typeof v === 'number');
    const minOf = k => { const v = num(k); return v.length ? Math.min(...v) : null; };
    const maxOf = k => { const v = num(k); return v.length ? Math.max(...v) : null; };
    const hasR  = k => { const v = num(k); return v.length >= 2 && Math.min(...v) !== Math.max(...v); };

    return {
      pais,
      latest_periodo:          periodos[0]                           ?? null,
      renta_prom_m2_mes:       minOf('renta_prom_m2_mes'),
      renta_prom_m2_mes_max:   hasR('renta_prom_m2_mes') ? maxOf('renta_prom_m2_mes') : null,
      disponibilidad:          minOf('disponibilidad'),
      disponibilidad_max:      hasR('disponibilidad')    ? maxOf('disponibilidad')    : null,
      inventario_total_m2:     minOf('inventario_total_m2'),
      cap_rate:                minOf('cap_rate'),
      cap_rate_max:            hasR('cap_rate')           ? maxOf('cap_rate')           : null,
      absorc_neta_trim_m2:     minOf('absorc_neta_trim_m2'),
      subzona_count:           bySubzona.length,
    };
  });

  return results.sort((a, b) => {
    const ra = a.renta_prom_m2_mes;
    const rb = b.renta_prom_m2_mes;
    if (ra != null && rb != null) return rb - ra;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return a.pais.localeCompare(b.pais);
  });
}

// ── aggregateByTipo ───────────────────────────────────────────────────────────
/**
 * Pivots per-class columns (A+, A, B) into summary rows.
 * Each row in subzonaRows has keys like renta_aplus_m2_mes, inventario_a_m2, etc.
 * These come from sheet headers like "Renta A+ ($/m²/mes)" after normalizeKey
 * converts "+" → "plus" (so A+ and A don't collide).
 */

const CLASE_DEFS = [
  { label: 'A+', renta: 'renta_aplus_m2_mes', inv: 'inventario_aplus_m2', disp: 'disponibilidad_aplus' },
  { label: 'A',  renta: 'renta_a_m2_mes',     inv: 'inventario_a_m2',     disp: 'disponibilidad_a'    },
  { label: 'B',  renta: 'renta_b_m2_mes',     inv: 'inventario_b_m2',     disp: 'disponibilidad_b'    },
];

export function aggregateByTipo(subzonaRows) {
  if (!subzonaRows.length) return [];

  return CLASE_DEFS.map(cls => {
    const rentas = subzonaRows.map(r => r[cls.renta]).filter(v => v != null && typeof v === 'number');
    const invs   = subzonaRows.map(r => r[cls.inv]).filter(v => v != null && typeof v === 'number');
    const disps  = subzonaRows.map(r => r[cls.disp]).filter(v => v != null && typeof v === 'number');

    if (!rentas.length && !invs.length && !disps.length) return null;

    const rentaMin = rentas.length ? Math.min(...rentas) : null;
    const rentaMax = rentas.length ? Math.max(...rentas) : null;

    return {
      tipo:                cls.label,
      renta_min:           rentaMin,
      renta_max:           rentaMax !== rentaMin ? rentaMax : null,
      inventario_total_m2: invs.length  ? invs.reduce((a, b) => a + b, 0)                 : null,
      disponibilidad_avg:  disps.length ? disps.reduce((a, b) => a + b, 0) / disps.length : null,
      subzona_count:       subzonaRows.filter(r => r[cls.renta] != null || r[cls.inv] != null).length,
    };
  }).filter(Boolean);
}

// ── aggregateRows ─────────────────────────────────────────────────────────────
/**
 * Main entry point.  Calls all helpers and returns a single aggregated object
 * ready for API responses and frontend consumption.
 *
 * @param {object[]} rows - Flattened rows from queryMarketData()
 * @returns {object}
 */
export function aggregateRows(rows) {
  if (!Array.isArray(rows)) rows = [];
  rows = rows.map(normalizeAliases);

  const city_total         = getCityTotal(rows);
  const by_subzona         = latestBySubzona(rows);
  const trend              = getTrendData(rows);
  const available_periodos = getAvailablePeriodos(rows);

  // Metric cards: use all city-total rows for the latest period so ranges are
  // computed across multiple broker reports.  If no city-total rows exist,
  // fall back to the subzone rows (ranges across subzonas/tipos).
  const cityTotalRows = getCityTotalRows(rows);
  const metric_cards  = buildMetricCards(cityTotalRows, by_subzona);
  const by_tipo       = aggregateByTipo(by_subzona);

  const uniqueReferencias = new Set(
    rows.map(r => r.referencia).filter(Boolean)
  );

  return {
    city_total,
    by_subzona,
    by_tipo,
    trend,
    metric_cards,
    available_periodos,
    subzona_count:  by_subzona.length,
    source_count:   uniqueReferencias.size,
    latest_periodo: available_periodos[0] ?? null,
  };
}
