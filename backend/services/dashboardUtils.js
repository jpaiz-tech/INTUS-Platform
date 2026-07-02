/**
 * Utilities for reading and modifying the ETRA dashboard DATA array.
 * All mutations are done on in-memory strings — never on the original file directly.
 */

import vm from 'vm';

// ── Bracket-aware DATA array locator ─────────────────────────────────────────

export function findDataArrayBounds(html) {
  const match = html.match(/(const|let|var)\s+DATA\s*=\s*\[/);
  if (!match) return null;

  const openIdx = match.index + match[0].length - 1;
  let depth = 0;
  let i     = openIdx;

  while (i < html.length) {
    const ch = html[i];

    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < html.length) {
        if (html[i] === '\\') { i += 2; continue; }
        if (html[i] === q)    break;
        i++;
      }
      i++;
      continue;
    }

    if (ch === '`') {
      i++;
      while (i < html.length) {
        if (html[i] === '\\') { i += 2; continue; }
        if (html[i] === '`')  break;
        i++;
      }
      i++;
      continue;
    }

    if (ch === '[') { depth++; }
    if (ch === ']') {
      depth--;
      if (depth === 0) return { openIdx, closeIdx: i };
    }

    i++;
  }

  return null;
}

// ── Duplicate sector name check ───────────────────────────────────────────────

export function checkDuplicateSector(dataArrayContent, sectorName) {
  const escaped = sectorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`"?name"?\\s*:\\s*['"\`]${escaped}['"\`]`);
  return pattern.test(dataArrayContent);
}

// ── Top-level object boundary finder ─────────────────────────────────────────

function findTopLevelObjectContaining(str, pos) {
  let depth    = 0;
  let objStart = -1;
  let i        = 0;

  while (i < str.length) {
    const ch = str[i];

    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < str.length) {
        if (str[i] === '\\') { i += 2; continue; }
        if (str[i] === q)    break;
        i++;
      }
      i++;
      continue;
    }

    if (ch === '`') {
      i++;
      while (i < str.length) {
        if (str[i] === '\\') { i += 2; continue; }
        if (str[i] === '`')  break;
        i++;
      }
      i++;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        if (objStart <= pos && pos <= i) return { start: objStart, end: i };
        objStart = -1;
      }
    }

    i++;
  }

  return null;
}

// ── Constants for sector object transformation ────────────────────────────────

const SC_LABELS = {
  mission:    'Mission Critical',
  important:  'Operationally Significant',
  substitute: 'Substitutable',
};

const DIM_ORDER = ['durabilidad', 'solidez', 'adhesion', 'solvencia', 'resiliencia'];
const DIM_LABEL_MAP = {
  durabilidad: 'DURABILIDAD',
  solidez:     'SOLIDEZ',
  adhesion:    'ADHESIÓN',
  solvencia:   'SOLVENCIA',
  resiliencia: 'RESILIENCIA',
};
const DIM_WEIGHTS = {
  durabilidad: 0.27,
  solidez:     0.22,
  adhesion:    0.18,
  solvencia:   0.16,
  resiliencia: 0.17,
};

const VALID_TAGS = new Set(['VERIFIED', 'PROXY', 'ESTIMATED', 'NOT FOUND']);

// ── Score → color map ─────────────────────────────────────────────────────────

function colorForScore(score) {
  if (score >= 85) return '#2D5E32';
  if (score >= 75) return '#4A6B4E';
  if (score >= 60) return '#B8893A';
  if (score >= 45) return '#A0522A';
  return '#8E3A3A';
}

// ── Sub tag normaliser ────────────────────────────────────────────────────────

/**
 * Normalises a sub evidence tag, stripping brackets and unifying NOT_FOUND variants.
 * Falls back to extracting a tag embedded in the note field (e.g. "[PROXY] ..." → tag PROXY).
 * Strips the bracket token from note after extraction.
 * Defaults to ESTIMATED when nothing usable is found.
 */
function normalizeSubTag(rawTag, note) {
  function clean(s) {
    if (!s) return '';
    let t = s.replace(/^\[+|\]+$/g, '').trim().toUpperCase();
    if (t === 'NOT_FOUND' || t === 'NOTFOUND') t = 'NOT FOUND';
    return t;
  }

  if (rawTag) {
    const t = clean(rawTag);
    if (VALID_TAGS.has(t)) return { tag: t, note: note || '' };
  }

  if (note) {
    const m = note.match(/\[(?:NOT FOUND|NOT_FOUND|VERIFIED|PROXY|ESTIMATED)\]/i);
    if (m) {
      const extracted = clean(m[0]);
      if (VALID_TAGS.has(extracted)) {
        const cleanNote = note.replace(m[0], '').trim();
        return { tag: extracted, note: cleanNote };
      }
    }
  }

  return { tag: 'ESTIMATED', note: note || '' };
}

// ── Find subsByFormat entry for a given formatScore ───────────────────────────

function findSubsForFormat(draft, formatScore) {
  const entries = draft.subsByFormat || [];

  // Exact match by any key
  const exact = entries.find(e =>
    e.format === formatScore.format ||
    e.format === formatScore.tabLabel ||
    e.format === formatScore.shortLabel
  );
  if (exact) return exact.subs || {};

  // Normalised fallback
  const normF = normalizeSectorName(formatScore.format || formatScore.tabLabel || '');
  if (!normF) return {};

  const fuzzy = entries.find(e => {
    const normE = normalizeSectorName(e.format || '');
    return normE && (normF.includes(normE) || normE.includes(normF));
  });

  return fuzzy ? (fuzzy.subs || {}) : {};
}

// ── Agent 3 compact JSON → dashboard sectorObject ────────────────────────────

/**
 * Converts the compact Agent 3 JSON (dashboardDraft + formatScores) into the
 * full sectorObject that the dashboard rendering code expects.
 *
 * dimScores layout:
 *   [0] { label: "Promedio", scores: [d, s, a, sv, r] }   — overall dimension totals
 *   [1..N] one row per formatScore using that format's per-dim scores
 *
 * tab.assets: [{ label: "Retail"|"Industrial"|"Office", score: number }]
 *   (object array, not string array)
 *
 * sub tags: normalised — no brackets, only VERIFIED / PROXY / ESTIMATED / NOT FOUND.
 *
 * Each dim gets a color derived from its score.
 */
export function transformSectorObject(parsedOutput) {
  const draft        = parsedOutput.dashboardDraft || {};
  const formatScores = parsedOutput.formatScores   || [];

  const rawConf    = (parsedOutput.confidence || 'MEDIUM').toUpperCase();
  const globalConf = ['HIGH', 'MEDIUM', 'LOW'].includes(rawConf) ? rawConf : 'MEDIUM';

  const clamp100 = v => typeof v === 'number' ? Math.round(Math.max(0, Math.min(100, v))) : 0;

  // ── Risks ─────────────────────────────────────────────────────────────────

  const risks = (draft.risks || []).map(r => ({
    risk:    r.risk    || '',
    type:    r.type    || 'Estructural',
    prob:    r.prob    || 'Media',
    impact:  r.impact  || 'Medio',
    horizon: r.horizon || '',
  }));

  // ── Per-format: recalculate dim scores from subs, then format score ────────
  //
  //   dim score   = round( avg(numeric subs) × 10 )
  //   format score = round( Σ dim_score × weight )

  const perFormat = formatScores.map(f => {
    const formatSubs = findSubsForFormat(draft, f);

    // Step 1 — dimension scores from sub scores (only thing trusted from Agent 3)
    const recalcDimScores = {};
    DIM_ORDER.forEach(key => {
      const rawSubs = formatSubs[key] || [];
      const numeric = rawSubs
        .filter(s => !s.spaceCriticality)
        .map(s => {
          const v = typeof s.s === 'number' ? s.s : parseFloat(s.s);
          return isNaN(v) ? null : Math.max(1, Math.min(10, v));
        })
        .filter(v => v !== null);

      recalcDimScores[key] = numeric.length > 0
        ? clamp100((numeric.reduce((sum, v) => sum + v, 0) / numeric.length) * 10)
        : 0;
    });

    // Step 2 — format score from weighted dimension scores
    const recalcFormatScore = Math.round(
      DIM_ORDER.reduce((sum, key) => sum + recalcDimScores[key] * DIM_WEIGHTS[key], 0)
    );

    // Step 3 — build dims using recalculated scores + processed subs
    const dims = DIM_ORDER.map(key => {
      const label   = DIM_LABEL_MAP[key];
      const score   = recalcDimScores[key];
      const rawSubs = formatSubs[key] || [];

      let subs;
      if (rawSubs.length > 0) {
        subs = rawSubs.map(sub => {
          const { tag, note } = normalizeSubTag(sub.tag, sub.note);
          const result = { n: sub.n || '' };

          if (sub.spaceCriticality) {
            result.spaceCriticality = {
              level: sub.spaceCriticality.level,
              label: SC_LABELS[sub.spaceCriticality.level] || sub.spaceCriticality.level,
            };
          } else {
            const rawS = typeof sub.s === 'number'
              ? sub.s
              : (parseFloat(sub.s) || Math.round(score / 10) || 5);
            result.s = Math.max(1, Math.min(10, Math.round(rawS)));
          }

          result.tag  = tag;
          result.note = note;
          return result;
        });
      } else {
        const fallbackS = Math.max(1, Math.min(10, Math.round(score / 10) || 1));
        subs = [
          { n: 'Evidencia', s: fallbackS, tag: 'ESTIMATED', note: 'Ver Agent 3' },
          { n: 'Riesgo',    s: fallbackS, tag: 'ESTIMATED', note: 'Ver QA' },
        ];
      }

      return { label, score, confidence: globalConf, color: colorForScore(score), subs };
    });

    return {
      formatScore:  recalcFormatScore,
      dimScoresMap: recalcDimScores,
      tabLabel:     f.tabLabel   || '',
      shortLabel:   f.shortLabel || '',
      assetType:    f.assetType  || 'Retail',
      dims,
    };
  });

  // ── Sector score: avg of format scores ────────────────────────────────────

  const allFormatScores = perFormat.map(pf => pf.formatScore);
  const scoreExact = allFormatScores.length > 0
    ? Math.round((allFormatScores.reduce((sum, s) => sum + s, 0) / allFormatScores.length) * 10) / 10
    : 0;
  const sectorScore = Math.round(scoreExact);

  // ── Promedio: per-dimension average across all formats ────────────────────

  const promedioScores = DIM_ORDER.map(key => {
    const vals = perFormat.map(pf => pf.dimScoresMap[key]);
    return vals.length > 0
      ? Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length)
      : 0;
  });

  // ── dimScores table ───────────────────────────────────────────────────────

  const dimScores = [
    { label: 'Promedio', scores: promedioScores },
    ...perFormat.map(pf => ({
      label:  pf.shortLabel || pf.tabLabel || 'Format',
      scores: DIM_ORDER.map(key => pf.dimScoresMap[key]),
    })),
  ];

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = perFormat.map(pf => ({
    label:      pf.tabLabel,
    shortLabel: pf.shortLabel,
    score:      pf.formatScore,
    assets:     [{ label: pf.assetType, score: pf.formatScore }],
    dims:       pf.dims,
  }));

  // ── Top-level fields ──────────────────────────────────────────────────────

  const topAssets = Array.isArray(draft.assets) && draft.assets.length > 0
    ? draft.assets
    : [...new Set(formatScores.map(f => f.assetType).filter(Boolean))];

  const assetChips = tabs.map(t => ({ label: t.shortLabel, score: t.score, pending: false }));

  const reco = {
    text:      draft.sectorReco      || '',
    verdict:   draft.sectorVerdict   || '',
    risks,
    capexNote: draft.sectorCapexNote || '',
  };

  return {
    name:       draft.name || parsedOutput.industry || '',
    sub:        draft.sub  || '',
    score:      sectorScore,
    scoreExact,
    assets:     topAssets,
    expanded:   false,
    hasDetail:  true,
    dimScores,
    assetChips,
    reco,
    tabs,
  };
}

// ── sectorObject structure validator ─────────────────────────────────────────

/**
 * Validates the generated dashboard sectorObject (output of transformSectorObject).
 * Returns an array of error strings; empty array means valid.
 */
export function validateSectorObject(obj) {
  const errs = [];
  if (!obj || typeof obj !== 'object') {
    errs.push('sectorObject must be an object');
    return errs;
  }

  // Top-level fields
  if (typeof obj.name !== 'string' || !obj.name) errs.push('name must be a non-empty string');
  if (typeof obj.sub !== 'string')                errs.push('sub must be a string');
  if (typeof obj.score !== 'number')              errs.push('score must be a number');
  if (typeof obj.scoreExact !== 'number')         errs.push('scoreExact must be a number');
  if (!Array.isArray(obj.assets))                 errs.push('assets must be an array');
  if (typeof obj.expanded !== 'boolean')          errs.push('expanded must be a boolean');
  if (typeof obj.hasDetail !== 'boolean')         errs.push('hasDetail must be a boolean');
  if (!Array.isArray(obj.dimScores))              errs.push('dimScores must be an array');
  if (!Array.isArray(obj.assetChips))             errs.push('assetChips must be an array');
  if (!obj.reco || typeof obj.reco !== 'object')  errs.push('reco must be an object');
  if (!Array.isArray(obj.tabs))                   errs.push('tabs must be an array');

  // assetChips
  if (Array.isArray(obj.assetChips)) {
    obj.assetChips.forEach((chip, i) => {
      if (typeof chip.label !== 'string') errs.push(`assetChips[${i}].label must be a string`);
      if (typeof chip.score !== 'number') errs.push(`assetChips[${i}].score must be a number`);
    });
  }

  // reco
  if (obj.reco && typeof obj.reco === 'object') {
    if (typeof obj.reco.text      !== 'string') errs.push('reco.text must be a string');
    if (typeof obj.reco.verdict   !== 'string') errs.push('reco.verdict must be a string');
    if (typeof obj.reco.capexNote !== 'string') errs.push('reco.capexNote must be a string');
    if (!Array.isArray(obj.reco.risks))         errs.push('reco.risks must be an array');
    if (Array.isArray(obj.reco.risks)) {
      obj.reco.risks.forEach((r, i) => {
        if (typeof r.risk    !== 'string') errs.push(`reco.risks[${i}].risk must be a string`);
        if (typeof r.type    !== 'string') errs.push(`reco.risks[${i}].type must be a string`);
        if (typeof r.prob    !== 'string') errs.push(`reco.risks[${i}].prob must be a string`);
        if (typeof r.impact  !== 'string') errs.push(`reco.risks[${i}].impact must be a string`);
        if (typeof r.horizon !== 'string') errs.push(`reco.risks[${i}].horizon must be a string`);
      });
    }
  }

  // dimScores
  if (Array.isArray(obj.dimScores)) {
    if (obj.dimScores.length < 1)
      errs.push('dimScores must have at least 1 row');
    if (obj.dimScores[0]?.label !== 'Promedio')
      errs.push('dimScores[0].label must be "Promedio"');

    obj.dimScores.forEach((row, i) => {
      if (typeof row.label !== 'string')
        errs.push(`dimScores[${i}].label must be a string`);
      if (!Array.isArray(row.scores) || row.scores.length !== 5)
        errs.push(`dimScores[${i}].scores must be an array of 5 numbers`);
      else row.scores.forEach((s, j) => {
        if (typeof s !== 'number' || s < 0 || s > 100)
          errs.push(`dimScores[${i}].scores[${j}] must be a number 0-100 (got ${s})`);
      });
    });
  }

  // tabs
  if (Array.isArray(obj.tabs)) {
    obj.tabs.forEach((tab, ti) => {
      const tp = `tabs[${ti}]`;
      if (typeof tab.label !== 'string')      errs.push(`${tp}.label must be a string`);
      if (typeof tab.shortLabel !== 'string') errs.push(`${tp}.shortLabel must be a string`);
      if (typeof tab.score !== 'number')      errs.push(`${tp}.score must be a number`);
      if (!Array.isArray(tab.assets))         errs.push(`${tp}.assets must be an array`);
      if (!Array.isArray(tab.dims))           errs.push(`${tp}.dims must be an array`);

      // tab.assets — must be objects with {label, score}
      if (Array.isArray(tab.assets)) {
        tab.assets.forEach((a, ai) => {
          if (typeof a !== 'object' || a === null || Array.isArray(a))
            errs.push(`${tp}.assets[${ai}] must be an object`);
          else {
            if (typeof a.label !== 'string') errs.push(`${tp}.assets[${ai}].label must be a string`);
            if (typeof a.score !== 'number') errs.push(`${tp}.assets[${ai}].score must be a number`);
          }
        });
      }

      // tab.dims — must be exactly 5
      if (Array.isArray(tab.dims)) {
        if (tab.dims.length !== 5)
          errs.push(`${tp}.dims must have exactly 5 elements (got ${tab.dims.length})`);

        tab.dims.forEach((dim, di) => {
          const dp = `${tp}.dims[${di}]`;
          if (typeof dim.label !== 'string')
            errs.push(`${dp}.label must be a string`);
          if (typeof dim.score !== 'number' || dim.score < 0 || dim.score > 100)
            errs.push(`${dp}.score must be a number 0-100 (got ${dim.score})`);
          if (!['HIGH', 'MEDIUM', 'LOW'].includes(dim.confidence))
            errs.push(`${dp}.confidence must be HIGH, MEDIUM, or LOW (got "${dim.confidence}")`);
          if (typeof dim.color !== 'string' || !dim.color)
            errs.push(`${dp}.color must be a non-empty string`);
          if (!Array.isArray(dim.subs))
            errs.push(`${dp}.subs must be an array`);
          else {
            dim.subs.forEach((sub, si) => {
              const sp = `${dp}.subs[${si}]`;
              if (typeof sub.n !== 'string') errs.push(`${sp}.n must be a string`);
              if (!sub.spaceCriticality) {
                if (typeof sub.s !== 'number' || sub.s < 1 || sub.s > 10)
                  errs.push(`${sp}.s must be a number 1-10 (got ${sub.s})`);
              }
              if (!VALID_TAGS.has(sub.tag))
                errs.push(`${sp}.tag must be VERIFIED, PROXY, ESTIMATED, or NOT FOUND (got "${sub.tag}")`);
              if (typeof sub.note !== 'string')
                errs.push(`${sp}.note must be a string`);
            });
          }
        });
      }
    });
  }

  return errs;
}

// ── Raw parsedOutput validator (Agent 3 compact JSON) ────────────────────────

const VALID_ASSETS = ['Retail', 'Industrial', 'Office'];

/**
 * Validates the raw parsedOutput from Agent 3 before transformation.
 * Returns an array of error strings; empty array means valid.
 */
export function validateParsedOutput(parsed) {
  const errs = [];

  if (parsed.agent !== 'agent3')              errs.push('agent must be "agent3"');
  if (typeof parsed.finalScore  !== 'number') errs.push('finalScore must be a number');
  if (typeof parsed.scoreExact  !== 'number') errs.push('scoreExact must be a number');
  if (!parsed.dashboardDraft)                 errs.push('dashboardDraft is required');
  if (!Array.isArray(parsed.formatScores))    errs.push('formatScores must be an array');
  if (!parsed.dimensionScores)                errs.push('dimensionScores is required');

  if (!parsed.dashboardDraft) return errs;
  const dd = parsed.dashboardDraft;

  if (!dd.name)                         errs.push('dashboardDraft.name is required');
  if (!Array.isArray(dd.assets))        errs.push('dashboardDraft.assets must be an array');
  if (!Array.isArray(dd.subsByFormat))  errs.push('dashboardDraft.subsByFormat must be an array');

  if (Array.isArray(dd.assets)) {
    dd.assets.forEach((a, i) => {
      if (!VALID_ASSETS.includes(a))
        errs.push(`dashboardDraft.assets[${i}] must be Retail, Industrial, or Office (got "${a}")`);
    });
  }

  if (Array.isArray(parsed.formatScores)) {
    parsed.formatScores.forEach((f, fi) => {
      const p = `formatScores[${fi}]`;
      if (!f.tabLabel)                           errs.push(`${p}.tabLabel is required`);
      if (!f.shortLabel)                         errs.push(`${p}.shortLabel is required`);
      if (!VALID_ASSETS.includes(f.assetType))   errs.push(`${p}.assetType must be Retail, Industrial, or Office (got "${f.assetType}")`);
      if (typeof f.formatScore !== 'number')     errs.push(`${p}.formatScore must be a number`);
      if (!Array.isArray(f.scores) || f.scores.length !== 5)
        errs.push(`${p}.scores must be an array of 5 numbers`);
    });
  }

  return errs;
}

// ── HTML DATA array modifier ──────────────────────────────────────────────────

/**
 * Given the full dashboard HTML and a dashboard-compatible sectorObject,
 * returns a new HTML string with the sector inserted (or replaced) in the DATA array.
 *
 * Validates the sectorObject schema before inserting.
 * Checks for double-comma after insertion.
 * Runs a vm smoke test on the DATA array before returning.
 *
 * @returns {{ html: string, warning?: string, duplicate?: boolean }}
 */
export function insertSectorIntoHtml(html, sectorObject, overwriteExisting = false) {

  // ── Validate sectorObject before any insertion ─────────────────────────────
  const sectorErrors = validateSectorObject(sectorObject);
  if (sectorErrors.length > 0) {
    const preview = sectorErrors.slice(0, 3).join('; ');
    const extra   = sectorErrors.length > 3 ? ` (+ ${sectorErrors.length - 3} more)` : '';
    return {
      html,
      warning: `sectorObject validation failed: ${preview}${extra}. Dashboard not updated.`,
    };
  }

  // ── Locate DATA array ──────────────────────────────────────────────────────
  const bounds = findDataArrayBounds(html);
  if (!bounds) {
    return { html, warning: 'DATA array not found. Agent 3 run saved but dashboard not updated.' };
  }

  const { openIdx, closeIdx } = bounds;
  const innerContent = html.slice(openIdx + 1, closeIdx);

  const isDuplicate = checkDuplicateSector(innerContent, sectorObject.name);
  let newObjStr = JSON.stringify(sectorObject, null, 2);
  newObjStr = newObjStr.replace(
    /"scoreExact":\s*(\d+)(?![\d.])/g,
    (match, p1) => `"scoreExact": ${p1}.0`
  );

  if (isDuplicate && !overwriteExisting) {
    return {
      html,
      warning: 'Sector already exists in dashboard. New dashboard file not created.',
      duplicate: true,
    };
  }

  // ── Build updated HTML ─────────────────────────────────────────────────────
  let updatedHtml;

  if (isDuplicate && overwriteExisting) {
    const escaped   = sectorObject.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern   = new RegExp(`"?name"?\\s*:\\s*['"\`]${escaped}['"\`]`);
    const nameMatch = pattern.exec(innerContent);
    if (!nameMatch) {
      return { html, warning: 'Existing sector found but safe replacement failed. Dashboard not updated.' };
    }

    const objBounds = findTopLevelObjectContaining(innerContent, nameMatch.index);
    if (!objBounds) {
      return { html, warning: 'Existing sector found but safe replacement failed. Dashboard not updated.' };
    }

    const before = html.slice(0, openIdx + 1) + innerContent.slice(0, objBounds.start);
    const after  = innerContent.slice(objBounds.end + 1) + html.slice(closeIdx);
    updatedHtml  = before + newObjStr + after;

  } else {
    // Append: trim trailing whitespace from inner content, add exactly one comma if needed
    const trimmedInner = innerContent.trimEnd();
    const hasExisting  = trimmedInner.length > 0;

    let separator = '\n  '; // default for empty array
    if (hasExisting) {
      separator = trimmedInner.endsWith(',') ? '\n  ' : ',\n  ';
    }

    const updatedInner = trimmedInner + separator + newObjStr + '\n';
    updatedHtml = html.slice(0, openIdx + 1) + updatedInner + html.slice(closeIdx);
  }

  // ── Double-comma guard ─────────────────────────────────────────────────────
  if (/,\s*,\s*\{/.test(updatedHtml) || /\}\s*,\s*,/.test(updatedHtml)) {
    return {
      html,
      warning: 'Generated dashboard HTML has double-comma syntax error. Dashboard not updated.',
    };
  }

  // ── Smoke test: re-parse DATA array in a sandbox ───────────────────────────
  try {
    const dataDecl = updatedHtml.match(/(const|let|var)\s+DATA\s*=\s*\[/);
    if (dataDecl) {
      const newBounds = findDataArrayBounds(updatedHtml);
      if (newBounds) {
        const code = updatedHtml
          .slice(dataDecl.index, newBounds.closeIdx + 1)
          .replace(/^(const|let)\s+DATA\s*=/, 'var DATA =') + ';';
        const ctx  = Object.create(null);
        vm.runInNewContext(code, ctx, { timeout: 5000 });

        if (!Array.isArray(ctx.DATA)) {
          return { html, warning: 'Smoke test failed: DATA is not an array after insertion. Dashboard not updated.' };
        }

        // For non-overwrite, the inserted sector is the last element
        if (!overwriteExisting) {
          const nameCount = ctx.DATA.filter(s => s && s.name === sectorObject.name).length;
          if (nameCount !== 1) {
            return { html, warning: `Smoke test failed: sector "${sectorObject.name}" appears ${nameCount} times. Dashboard not updated.` };
          }
        }

        // Structural spot-check on inserted/overwritten sector
        const inserted = !overwriteExisting
          ? ctx.DATA[ctx.DATA.length - 1]
          : ctx.DATA.find(s => s && s.name === sectorObject.name);

        if (inserted) {
          if (!Array.isArray(inserted.dimScores?.[0]?.scores) || inserted.dimScores[0].scores.length !== 5) {
            return { html, warning: 'Smoke test failed: dimScores[0].scores is invalid in inserted sector. Dashboard not updated.' };
          }
          if (!Array.isArray(inserted.tabs?.[0]?.dims) || inserted.tabs[0].dims.length !== 5) {
            return { html, warning: 'Smoke test failed: tabs[0].dims is invalid in inserted sector. Dashboard not updated.' };
          }
          if (typeof inserted.tabs?.[0]?.assets?.[0]?.label !== 'string') {
            return { html, warning: 'Smoke test failed: tabs[0].assets[0].label is invalid in inserted sector. Dashboard not updated.' };
          }
        }
      }
    }
  } catch (smokeErr) {
    return {
      html,
      warning: `Smoke test failed: ${smokeErr.message}. Dashboard not updated.`,
    };
  }

  return { html: updatedHtml };
}

// ── Dashboard context extractor ───────────────────────────────────────────────

export function extractDashboardContext(dashboardHtml) {
  const EMPTY = { existingSectors: [], sectorNames: [], tabLabels: [], assetTypes: [] };

  const match = dashboardHtml.match(/(const|let|var)\s+DATA\s*=\s*\[/);
  if (!match) return { ...EMPTY, warning: 'DATA declaration not found in dashboard' };

  const bounds = findDataArrayBounds(dashboardHtml);
  if (!bounds) return { ...EMPTY, warning: 'DATA array bounds not found in dashboard' };

  const { closeIdx } = bounds;
  const code = dashboardHtml
    .slice(match.index, closeIdx + 1)
    .replace(/^(const|let)\s+DATA\s*=/, 'var DATA =') + ';';

  let DATA;
  try {
    const ctx = Object.create(null);
    vm.runInNewContext(code, ctx, { timeout: 5000 });
    DATA = ctx.DATA;
  } catch (err) {
    return { ...EMPTY, warning: `Could not parse DATA array: ${err.message}` };
  }

  if (!Array.isArray(DATA)) return { ...EMPTY, warning: 'DATA is not an array after eval' };

  const existingSectors = DATA.map(sector => ({
    name:      sector.name  || '',
    sub:       sector.sub   || '',
    score:     sector.score || 0,
    assets:    Array.isArray(sector.assets) ? sector.assets : [],
    dimScores: Array.isArray(sector.dimScores) ? sector.dimScores : [],
    tabs:      Array.isArray(sector.tabs)
      ? sector.tabs.map(t => ({
          label:      t.label      || '',
          shortLabel: t.shortLabel || '',
          score:      t.score      || 0,
        }))
      : [],
  }));

  const sectorNames = existingSectors.map(s => s.name).filter(Boolean);
  const tabLabels   = existingSectors.flatMap(s => s.tabs.map(t => t.label)).filter(Boolean);
  const assetTypes  = [...new Set(existingSectors.flatMap(s => s.assets))];

  return { existingSectors, sectorNames, tabLabels, assetTypes };
}

// ── Sector name normaliser ────────────────────────────────────────────────────

export function normalizeSectorName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Synonym groups for cross-language sector matching ────────────────────────

const SYNONYM_GROUPS = [
  ['supermercado', 'supermercados', 'grocery', 'groceries', 'supermarket', 'supermarkets', 'conveniencia', 'convenience store'],
  ['farmacia', 'farmacias', 'pharmaceutical', 'pharmaceuticals', 'pharma', 'pharmacy', 'pharmacies', 'farmaceutica', 'farmaceutico'],
  ['cosmetica', 'cosmeticos', 'belleza', 'beauty', 'cosmetics', 'cosmetic', 'cosmetico'],
  ['telecom', 'telecomunicaciones', 'telecommunications', 'telecomunicacion'],
  ['call center', 'bpo', 'contact center', 'business process outsourcing', 'centro de llamadas'],
  ['healthcare', 'salud', 'medical', 'medico', 'clinica', 'clinicas', 'hospital', 'hospitales'],
  ['retail', 'comercio minorista', 'tienda por departamento'],
  ['restaurante', 'restaurantes', 'restaurant', 'restaurants', 'food service', 'foodservice', 'qsr', 'fast food'],
  ['banco', 'bancos', 'bank', 'banks', 'financiero', 'financial services', 'banca'],
  ['ferreteria', 'ferreterias', 'hardware store', 'home improvement', 'mejoras del hogar'],
];

function normContainsGroupTerm(norm, group) {
  return group.some(term => norm === term || norm.includes(term));
}

function areSynonymsOrMatch(normA, normB) {
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;
  const wordsA = normA.split(' ').filter(w => w.length > 3);
  const wordsB = normB.split(' ').filter(w => w.length > 3);
  if (wordsA.some(w => normB.includes(w)) || wordsB.some(w => normA.includes(w))) return true;
  for (const group of SYNONYM_GROUPS) {
    if (normContainsGroupTerm(normA, group) && normContainsGroupTerm(normB, group)) return true;
  }
  return false;
}

// ── Real estate type normaliser ───────────────────────────────────────────────

const RE_TYPE_ALIASES = {
  retail:     ['retail', 'tienda', 'tiendas', 'local', 'locales', 'storefront', 'comercial', 'comercio'],
  industrial: ['industrial', 'warehouse', 'bodega', 'bodegas', 'distribucion', 'logistica', 'logistics',
               'cold storage', 'almacen', 'almacenes', 'deposito', 'centro de distribucion', 'cdis', 'dc'],
  office:     ['office', 'oficina', 'oficinas', 'hq', 'back office', 'backoffice', 'sede', 'corporativo',
               'corporativa', 'headquarters', 'headquarter'],
};

function normalizeREType(reType) {
  if (!reType) return null;
  const norm = normalizeSectorName(reType);
  for (const [canonical, aliases] of Object.entries(RE_TYPE_ALIASES)) {
    if (aliases.some(alias => norm === alias || norm.includes(alias))) return canonical;
  }
  return norm;
}

function sectorHasTabMatchingType(sector, reType) {
  const canonicalType = normalizeREType(reType);
  if (!canonicalType) return false;

  const assets = sector.assets || [];
  if (canonicalType === 'retail'     && assets.includes('Retail'))     return true;
  if (canonicalType === 'office'     && assets.includes('Office'))     return true;
  if (canonicalType === 'industrial' && assets.includes('Industrial')) return true;

  return (sector.tabs || []).some(tab => {
    const tNorm = normalizeSectorName(tab.label || '');
    if (canonicalType === 'retail')     return tNorm.includes('retail');
    if (canonicalType === 'office')     return tNorm.includes('oficina') || tNorm.includes('office');
    if (canonicalType === 'industrial') return tNorm.includes('industrial') || tNorm.includes('logistic')
                                             || tNorm.includes('cold') || tNorm.includes('bodega');
    return tNorm.includes(canonicalType);
  });
}

// ── Pre-Claude research blocker ───────────────────────────────────────────────

export function checkResearchBlockers({ industry, realEstateType, company, dashboardContext }) {
  if (!dashboardContext?.existingSectors?.length) {
    return { blocked: false };
  }

  const normI = normalizeSectorName(industry || '');
  if (!normI) return { blocked: false };

  let matchedSector = null;
  for (const sector of dashboardContext.existingSectors) {
    if (areSynonymsOrMatch(normI, normalizeSectorName(sector.name))) {
      matchedSector = sector;
      break;
    }
  }

  if (!matchedSector) return { blocked: false };

  const hasType    = !!(realEstateType && realEstateType.trim());
  const hasCompany = !!(company && company.trim());

  if (!hasType && !hasCompany) {
    return {
      blocked:   true,
      blockCode: 'DUPLICATE_SECTOR',
      message:   `"${industry}" already exists in the dashboard. Add a Real Estate Type, a Company, or enable overwrite to proceed.`,
      matchedSectorName: matchedSector.name,
    };
  }

  if (hasType) {
    const typeCovered = sectorHasTabMatchingType(matchedSector, realEstateType);

    if (typeCovered && !hasCompany) {
      return {
        blocked:   true,
        blockCode: 'DUPLICATE_SECTOR_TYPE',
        message:   `"${industry}" already exists and already covers "${realEstateType}". Choose a different type, add a Company for a specific angle, or enable overwrite.`,
        matchedSectorName: matchedSector.name,
        matchedType:       realEstateType,
      };
    }

    const researchMode = hasCompany ? 'existing_sector_company_type' : 'existing_sector_new_type';
    return {
      blocked:              false,
      researchMode,
      matchedSectorName:    matchedSector.name,
      isExistingSectorAddon: true,
    };
  }

  return {
    blocked:              false,
    researchMode:         'existing_sector_company',
    matchedSectorName:    matchedSector.name,
    isExistingSectorAddon: true,
  };
}

// ── Dashboard overlap detector ────────────────────────────────────────────────

export function detectDashboardOverlap({ industry, realEstateType, company, dashboardContext }) {
  if (!dashboardContext?.existingSectors?.length) {
    return { possibleOverlap: false, matches: [], warning: '' };
  }

  const normI = normalizeSectorName(industry  || '');
  const normC = normalizeSectorName(company   || '');

  const matchedSectorNames = new Set();
  const matches = [];

  for (const sector of dashboardContext.existingSectors) {
    const normName = normalizeSectorName(sector.name);
    const normSub  = normalizeSectorName(sector.sub || '');

    const nameMatch = normI && normName && (
      normName.includes(normI) ||
      normI.includes(normName) ||
      normI.split(' ').some(w => w.length > 4 && normName.includes(w))
    );

    const subMatch = normI && normSub && normSub.length > 4 && (
      normSub.includes(normI) || normI.includes(normSub)
    );

    const tabMatch = normI && (sector.tabs || []).some(t => {
      const normTab = normalizeSectorName(t.label);
      return normTab.length > 4 && (normTab.includes(normI) || normI.includes(normTab));
    });

    const companyMatch = normC && normName && normName.length > 4 && (
      normName.includes(normC) || normC.includes(normName)
    );

    if (nameMatch || subMatch || tabMatch || companyMatch) {
      if (!matchedSectorNames.has(sector.name)) {
        matchedSectorNames.add(sector.name);
        const matchedOn = nameMatch  ? 'nombre del sector'
          : subMatch    ? 'subtítulo del sector'
          : tabMatch    ? 'etiqueta de tab'
          : 'nombre de empresa';
        matches.push({
          existingSectorName: sector.name,
          matchedOn,
          overlapType: nameMatch ? 'sector' : subMatch ? 'sub' : tabMatch ? 'tab' : 'company',
        });
      }
    }
  }

  // ── Format-level tab overlap ──────────────────────────────────────────────
  const normI2 = normalizeSectorName(industry || '');
  const normT2 = normalizeSectorName(realEstateType || '');
  dashboardContext.existingSectors.forEach(sector => {
    (sector.tabs || []).forEach(tab => {
      const normalizedTab = normalizeSectorName(tab.shortLabel || tab.label);
      if (!normalizedTab || normalizedTab.length < 3) return;
      if (
        (normI2 && (normalizedTab.includes(normI2) || normI2.includes(normalizedTab))) ||
        (normT2 && normalizedTab.includes(normT2))
      ) {
        matches.push({
          existingSectorName: `${sector.name} — ${tab.shortLabel || tab.label} (score: ${tab.score})`,
          reason: `Tab "${tab.shortLabel || tab.label}" in existing sector "${sector.name}" overlaps with requested industry/format`,
          overlapType: 'format',
        });
      }
    });
  });

  const possibleOverlap = matches.length > 0;
  const warning = possibleOverlap
    ? `Posible duplicado con: ${matches.map(m => `"${m.existingSectorName}" (${m.matchedOn || m.reason})`).join(', ')}. Verifique que el nuevo sector no repite cobertura existente.`
    : '';

  return { possibleOverlap, matches, warning };
}
