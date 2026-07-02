/**
 * Single source of truth for ETRA sector report HTML generation.
 * Style matches ETRA Legacy Fund investment document format.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLogoB64(filename) {
  try {
    return readFileSync(path.join(__dirname, '../assets', filename)).toString('base64');
  } catch { return ''; }
}

const LOGO_INTUS_B64 = loadLogoB64('logo-intus-black.gif');
const LOGO_INTUS_MIME = 'image/gif';
const LOGO_ETRA_B64  = loadLogoB64('logo-etra.png');

const scoreColor = s => s >= 75 ? '#2D6A35' : s >= 60 ? '#B8893A' : '#8E3A3A';
const tier       = s => s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D';

const CONNECTORS = ['', 'Adicionalmente, ', 'En este contexto, ', 'Respecto a la operación, ', 'Por otro lado, '];
const DIM_LABELS = ['DURABILIDAD', 'SOLIDEZ', 'ADHESIÓN', 'SOLVENCIA', 'RESILIENCIA'];

function stripMeta(str) {
  return String(str ?? '').replace(/\[(PROXY|VERIFIED|ESTIMATED|CALCULATED|SOURCE[DS]?)\]/gi, '').trim();
}

function buildFallbackProse(tab) {
  return (tab.dims || []).map((dim, di) => {
    const dimName = DIM_LABELS[di] || '';
    const score   = Math.round(dim.score || 0);
    const lvl     = score >= 80 ? 'alta' : score >= 70 ? 'adecuada' : score >= 60 ? 'moderada' : 'limitada';
    const openers = {
      DURABILIDAD: `La durabilidad estructural de este formato es ${lvl}, reflejando la capacidad del sector para mantenerse operativamente relevante durante el horizonte del fondo.`,
      SOLIDEZ:     `La solidez operativa y financiera del operador tipo es ${lvl}, ponderando escala, márgenes e historial de continuidad.`,
      'ADHESIÓN':  `La adhesión al espacio físico es ${lvl}, determinada por la criticidad operativa del inmueble y el costo real de reubicación.`,
      SOLVENCIA:   `El perfil de solvencia del arrendatario tipo configura una capacidad de pago ${lvl} que incide en la estabilidad del flujo de renta.`,
      RESILIENCIA: `La capacidad del sector para absorber shocks externos es ${lvl}, reflejando su exposición ante escenarios de estrés.`,
    };
    const opener = openers[dimName] || `La dimensión ${dimName} presenta un nivel ${lvl}.`;
    const subs   = (dim.subs || []).filter(s => s.note);
    if (!subs.length) return `<p>${opener}</p>`;
    const parts  = subs.map(s => {
      const note = stripMeta(s.note);
      const crit = s.spaceCriticality;
      if (crit) {
        const lbl = crit.level === 'mission' ? 'de carácter misión crítica' : crit.level === 'substitute' ? 'sustituible con bajo costo de reubicación' : 'operacionalmente significativa';
        return `La <strong>${s.n}</strong> es ${lbl}${note ? ` — ${note}` : ''}`;
      }
      return `<strong>${s.n}</strong>${note ? `: ${note}` : ''}`;
    });
    const prose = parts.map((p, i) => i === 0 ? p : (CONNECTORS[i] || 'Asimismo, ') + p).join('. ');
    return `<p>${opener} ${prose}.</p>`;
  }).join('\n');
}

/**
 * @param {object} sectorData      - Full sector object (tabs, reco, dimScores, etc.)
 * @param {object|null} reportSections - Agent 4 output, or null for fallback rendering
 */
export function generateReportHTML(sectorData, reportSections) {
  const reco = sectorData.reco || {};
  const now  = new Date();
  const monthYear = now.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' });
  const fullDate  = now.toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' });
  const sc = scoreColor(sectorData.score);
  const t  = tier(sectorData.score);

  // Deduplicate tabs — keep last occurrence of each shortLabel
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of [...(sectorData.tabs || [])].reverse()) {
    if (!seen.has(tab.shortLabel)) {
      seen.add(tab.shortLabel);
      uniqueTabs.unshift(tab);
    }
  }

  // Per-format sections
  const formatSections = uniqueTabs.map(tab => {
    const a4Format = reportSections?.formatAnalysis?.find(
      f => (f.formatName || '').toLowerCase().trim() === (tab.shortLabel || '').toLowerCase().trim()
    );
    const prose = a4Format
      ? Object.values(a4Format.dimensionParagraphs || {}).filter(Boolean).join('\n')
      : buildFallbackProse(tab);
    return `<h3 class="format-heading">${tab.shortLabel}</h3>\n${prose}`;
  }).join('\n\n');

  // Risk table
  const riskRows = (reco.risks || []).map(r => {
    const probCol   = /alto/i.test(r.prob)   ? '#8E3A3A' : /bajo/i.test(r.prob)   ? '#2D6A35' : '#B8893A';
    const impactCol = /alto/i.test(r.impact) ? '#8E3A3A' : '#B8893A';
    return `<tr>
      <td style="font-weight:500">${r.risk || ''}</td>
      <td style="color:#666;font-size:11px">${r.type || ''}</td>
      <td style="font-weight:600;color:${probCol}">${r.prob || ''}</td>
      <td style="font-weight:600;color:${impactCol}">${r.impact || ''}</td>
      <td style="color:#666;font-size:11px">${r.horizon || ''}</td>
    </tr>`;
  }).join('');

  const execHtml  = reportSections?.executiveSummary || (reco.text      ? `<p>${reco.text}</p>`      : '');
  const capexHtml = reportSections?.capexNarrative   || (reco.capexNote ? `<p>${reco.capexNote}</p>` : '');
  const recoHtml  = reportSections?.recoNarrative    || (reco.text      ? `<p>${reco.text}</p>`      : '');

  const verdictBox = reco.verdict
    ? `<div class="verdict-box"><p>${reco.verdict}</p></div>`
    : '';

  // Dynamic section numbering
  let n = 0;
  const sec = () => `${++n}.`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETRA — ${sectorData.name}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#EBEBEB; font-family:Arial,Helvetica,sans-serif; -webkit-print-color-adjust:exact; }

.page { background:#fff; max-width:760px; margin:32px auto; padding:52px 64px 52px; box-shadow:0 1px 8px rgba(0,0,0,0.13); }

/* ── Cover header ── */
.header-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
.logo-intus { height:58px; width:auto; }
.confidential { font-size:10px; font-style:italic; color:#888; padding-top:4px; }
hr.rule { border:none; border-top:1.5px solid #1A2E44; margin:0; }
hr.rule-thin { border:none; border-top:0.75px solid #C0C0C0; margin:0; }

.title-block { text-align:center; padding:22px 0 18px; }
.logo-etra { height:90px; width:auto; display:block; margin:0 auto 14px; }
.report-title { font-family:Georgia,serif; font-size:26px; font-weight:700; color:#1A2E44; line-height:1.25; margin-bottom:7px; }
.fund-name { font-size:14px; font-weight:700; color:#B8893A; letter-spacing:0.3px; margin-bottom:5px; }
.report-sub { font-size:11.5px; font-style:italic; color:#555; margin-bottom:5px; line-height:1.5; }
.report-meta { font-size:11px; color:#777; }

.score-strip { display:flex; justify-content:center; align-items:center; gap:10px; padding:10px 0 6px; }
.score-label { font-size:11px; color:#888; }
.score-val { font-size:20px; font-weight:700; color:${sc}; font-variant-numeric:tabular-nums; }
.tier-badge { font-size:10px; font-weight:700; padding:2px 9px; border:1.5px solid ${sc}; color:${sc}; letter-spacing:0.5px; }

/* ── Verdict ── */
.verdict-box { background:#FAFAF7; border-left:3px solid #B8893A; padding:11px 16px; margin:20px 0 4px; }
.verdict-box p { font-style:italic; font-size:12.5px; color:#5A4A2E; line-height:1.7; margin:0; }

/* ── Section headers ── */
h2 { font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:700; color:#1A2E44;
     margin:30px 0 10px; padding-bottom:5px; border-bottom:1.5px solid #1A2E44; }

/* ── Format sub-headers ── */
.format-heading { font-size:12.5px; font-weight:700; color:#1A2E44;
                  margin:20px 0 7px; padding-bottom:4px; border-bottom:0.75px solid #D5D5D5; }

/* ── Body text ── */
p { font-size:12px; line-height:1.85; color:#1A1A1A; margin:0 0 11px; }

/* ── Risk table ── */
table { width:100%; border-collapse:collapse; font-size:11.5px; margin:6px 0 0; }
thead tr { background:#1A2E44; }
thead th { padding:8px 11px; text-align:left; color:#fff; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
tbody tr:nth-child(even) { background:#F7F7F7; }
tbody td { padding:8px 11px; color:#1A1A1A; border-bottom:1px solid #E8E8E8; vertical-align:top; line-height:1.5; }

/* ── Footer ── */
.footer { display:flex; justify-content:space-between; margin-top:44px; padding-top:9px;
          border-top:1px solid #C8C8C8; font-size:10px; color:#888; }

@media print {
  body { background:#fff; }
  .page { box-shadow:none; margin:0; max-width:100%; padding:40px 56px; }
}
</style>
</head>
<body>
<div class="page">

  <div class="header-top">
    ${LOGO_INTUS_B64 ? `<img src="data:${LOGO_INTUS_MIME};base64,${LOGO_INTUS_B64}" class="logo-intus" alt="Intus Capital">` : '<span style="font-weight:700;font-size:13px;color:#1A2E44">Intus Capital</span>'}
    <span class="confidential">Confidencial – Para Inversionistas Calificados</span>
  </div>

  <hr class="rule">

  <div class="title-block">
    ${LOGO_ETRA_B64 ? `<img src="data:image/png;base64,${LOGO_ETRA_B64}" class="logo-etra" alt="ETRA Legacy">` : ''}
    <div class="report-title">${sectorData.name}</div>
    <div class="fund-name">ETRA Legacy Fund</div>
    ${sectorData.sub ? `<div class="report-sub">${sectorData.sub}</div>` : ''}
    <div class="report-meta">${monthYear} &nbsp;|&nbsp; Intus Capital Corp.</div>
  </div>

  <hr class="rule">

  <div class="score-strip">
    <span class="score-label">Score ETRA:</span>
    <span class="score-val">${sectorData.score}</span>
    <span class="tier-badge">Tier ${t}</span>
  </div>

  <hr class="rule-thin" style="margin-top:8px">

  ${verdictBox}

  ${execHtml    ? `<h2>${sec()} Resumen Ejecutivo</h2>${execHtml}` : ''}
  ${formatSections ? `<h2>${sec()} Análisis por Formato</h2>${formatSections}` : ''}
  ${capexHtml   ? `<h2>${sec()} CapEx y Stickiness</h2>${capexHtml}` : ''}
  ${riskRows    ? `<h2>${sec()} Factores de Riesgo</h2>
  <table>
    <thead><tr><th>Riesgo</th><th>Tipo</th><th>Probabilidad</th><th>Impacto</th><th>Horizonte</th></tr></thead>
    <tbody>${riskRows}</tbody>
  </table>` : ''}
  ${recoHtml    ? `<h2>${sec()} Recomendación de Inversión</h2>${recoHtml}` : ''}

  <div class="footer">
    <span>ETRA Legacy Fund – Análisis de Industria</span>
    <span>Intus Capital Corp. &nbsp;·&nbsp; ${fullDate}</span>
  </div>

</div>
</body>
</html>`;
}
