const DIM_KEYS    = ['durabilidad', 'solidez', 'adhesion', 'solvencia', 'resiliencia'];
const DIM_LABELS  = ['DURABILIDAD', 'SOLIDEZ', 'ADHESIÓN', 'SOLVENCIA', 'RESILIENCIA'];
const CONNECTORS  = ['', 'Adicionalmente, ', 'En este contexto, ', 'Respecto a la operación, ', 'Por otro lado, '];

// ── helpers ────────────────────────────────────────────────────────────────

function scoreColor(s) {
  return s >= 75 ? '#4A6B4E' : s >= 60 ? '#B8893A' : '#8E3A3A';
}
function tier(s) {
  return s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D';
}
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function stripMeta(str) {
  return String(str ?? '').replace(/\[(PROXY|VERIFIED|ESTIMATED|CALCULATED|SOURCE[DS]?)\]/gi, '').trim();
}

function riskTable(risks) {
  if (!risks?.length) return '';
  const rows = risks.map(r => {
    const pColor = /alto/i.test(r.prob)   ? '#8E3A3A' : /bajo/i.test(r.prob)   ? '#4A6B4E' : '#B8893A';
    const iColor = /alto/i.test(r.impact) ? '#8E3A3A' : '#B8893A';
    return `<tr>
      <td style="font-weight:500">${esc(r.risk)}</td>
      <td style="color:#6B7280;font-size:11px">${esc(r.type || '')}</td>
      <td style="color:${pColor};font-weight:600">${esc(r.prob || '')}</td>
      <td style="color:${iColor};font-weight:600">${esc(r.impact || '')}</td>
      <td style="color:#6B7280;font-size:12px">${esc(r.horizon || '')}</td>
    </tr>`;
  }).join('');
  return `<table>
    <thead><tr><th>Riesgo</th><th>Tipo</th><th>Probabilidad</th><th>Impacto</th><th>Horizonte</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildFallbackProse(tab) {
  return (tab.dims || []).map((dim, di) => {
    const dimName = DIM_LABELS[di] || '';
    const score   = Math.round(dim.score || 0);
    const lvl     = score >= 80 ? 'alta' : score >= 70 ? 'adecuada' : score >= 60 ? 'moderada' : 'limitada';
    const openers = {
      DURABILIDAD:  `La durabilidad estructural de este formato es ${lvl}, reflejando la capacidad del sector para mantenerse operativamente relevante durante el horizonte del fondo.`,
      SOLIDEZ:      `La solidez operativa y financiera del operador tipo es ${lvl}, ponderando escala, márgenes e historial de continuidad.`,
      'ADHESIÓN':   `La adhesión al espacio físico es ${lvl}, determinada por la criticidad operativa del inmueble y el costo real de reubicación.`,
      SOLVENCIA:    `El perfil de solvencia del arrendatario tipo configura una capacidad de pago ${lvl} que incide en la estabilidad del flujo de renta.`,
      RESILIENCIA:  `La capacidad del sector para absorber shocks externos es ${lvl}, reflejando su exposición ante escenarios de estrés.`,
    };
    const opener = openers[dimName] || `La dimensión ${dimName} presenta un nivel ${lvl}.`;
    const subs   = (dim.subs || []).filter(s => s.note);
    if (!subs.length) return `<p>${opener}</p>`;
    const parts  = subs.map(s => {
      const note = stripMeta(s.note);
      const crit = s.spaceCriticality;
      if (crit) {
        const lbl = crit.level === 'mission' ? 'de carácter misión crítica' : crit.level === 'substitute' ? 'sustituible con bajo costo de reubicación' : 'operacionalmente significativa';
        return `La <strong>${esc(s.n)}</strong> es ${lbl}${note ? ` — ${note}` : ''}`;
      }
      return `<strong>${esc(s.n)}</strong>${note ? `: ${note}` : ''}`;
    });
    const prose = parts.map((p, i) => i === 0 ? p : (CONNECTORS[i] || 'Asimismo, ') + p).join('. ');
    return `<p>${opener} ${prose}.</p>`;
  }).join('\n');
}

// ── main export ────────────────────────────────────────────────────────────

export function generateReportHtml(sector, dateIso, logos = {}) {
  const reportSections = logos.reportSections || sector.reportSections || null;
  const a4Formats      = reportSections?.formatAnalysis || [];

  const sc         = scoreColor(sector.score);
  const t          = tier(sector.score);
  const reportDate = new Date(dateIso || Date.now()).toLocaleDateString('es-PA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Deduplicate tabs — keep last occurrence of each shortLabel
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of [...(sector.tabs || [])].reverse()) {
    if (!seen.has(tab.shortLabel)) {
      seen.add(tab.shortLabel);
      uniqueTabs.unshift(tab);
    }
  }

  // Find Agent 4 format data by shortLabel match
  function findA4(tab) {
    return a4Formats.find(f =>
      (f.formatName || '').toLowerCase().trim() === (tab.shortLabel || '').toLowerCase().trim()
    ) || null;
  }

  const execSummaryHtml = reportSections?.executiveSummary
    || (sector.reco?.text ? `<p>${sector.reco.text}</p>` : '');
  const capexHtml = reportSections?.capexNarrative
    || (sector.reco?.capexNote ? `<p>${sector.reco.capexNote}</p>` : '');
  const recoHtml = reportSections?.recoNarrative
    || (sector.reco?.text ? `<p>${sector.reco.text}</p>` : '');

  // Per-format narrative sections (no score sub-headers)
  const formatSections = uniqueTabs.map(tab => {
    const a4    = findA4(tab);
    const prose = a4
      ? Object.values(a4.dimensionParagraphs || {}).filter(Boolean).join('\n')
      : buildFallbackProse(tab);
    return `<h3 class="format-heading">${esc(tab.shortLabel)}</h3>\n${prose}`;
  }).join('\n\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ETRA — ${esc(sector.name)}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background: #F4F0E6; font-family: Georgia, serif; }
.page { background: #FFFFFF; max-width: 800px; margin: 40px auto; padding: 52px 68px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.page-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E0DCD4; padding-bottom:12px; margin-bottom:28px; }
.page-header-label { font-family:Verdana,sans-serif; font-size:10px; color:#9B9490; letter-spacing:0.3px; }
.eyebrow { font-family:Verdana,sans-serif; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; color:#A88B4F; margin-bottom:10px; }
.report-title { font-family:Georgia,serif; font-size:26px; font-weight:700; color:#0D1F33; line-height:1.2; }
.report-sub { font-family:Georgia,serif; font-style:italic; font-size:14px; color:#5A6E7E; margin-top:6px; line-height:1.5; }
.meta-row { display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-top:14px; padding-bottom:20px; border-bottom:1px solid #EBEBEB; }
.meta-label { font-family:Verdana,sans-serif; font-size:11px; color:#9B9490; }
.meta-score { font-family:Verdana,sans-serif; font-size:18px; font-weight:700; color:${sc}; }
.meta-tier { font-family:Verdana,sans-serif; font-size:11px; font-weight:700; padding:2px 9px; border:1.5px solid ${sc}; border-radius:2px; color:${sc}; }
.verdict-box { background:#F8F7F4; border-left:3px solid #A88B4F; padding:14px 20px; margin:24px 0 0; }
.verdict-box p { font-family:Verdana,sans-serif; font-style:italic; font-size:13px; color:#5A4A2E; line-height:1.8; margin:0; }
h2 { font-family:Verdana,sans-serif; font-size:12px; font-weight:700; color:#0D1F33; letter-spacing:1px; text-transform:uppercase; margin:36px 0 14px; padding-bottom:8px; border-bottom:2px solid #0D1F33; }
.format-heading { font-family:Verdana,sans-serif; font-size:12px; font-weight:700; color:#0D1F33; margin:28px 0 12px; padding-bottom:6px; border-bottom:1px solid #D8D8D8; letter-spacing:0.5px; }
p { font-family:Georgia,serif; font-size:14px; line-height:1.9; color:#2A2A3E; margin:0 0 14px; }
table { width:100%; border-collapse:collapse; font-size:13px; margin:4px 0 0; font-family:Verdana,sans-serif; }
thead tr { background:#0D1F33; }
thead th { padding:9px 13px; text-align:left; color:#F4F0E6; font-size:10px; letter-spacing:1px; text-transform:uppercase; font-weight:600; }
tbody tr:nth-child(even) { background:#F8F7F4; }
tbody tr:nth-child(odd) { background:#FFFFFF; }
tbody td { padding:9px 13px; color:#2A2A3E; border-bottom:1px solid #EBEBEB; vertical-align:top; line-height:1.55; }
.footer { text-align:center; margin-top:52px; padding-top:14px; border-top:1px solid #E0E0E0; font-size:10px; color:#9B9490; font-family:Verdana,sans-serif; letter-spacing:0.3px; line-height:2; }
@media print { body { background:#fff; } .page { box-shadow:none; margin:0; max-width:100%; } }
</style>
</head>
<body>
<div class="page">

  <div class="page-header">
    <span style="font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;color:#0D1F33">ETRA</span>
    <span class="page-header-label">Análisis de Industria &nbsp;·&nbsp; ${reportDate}</span>
  </div>

  <div class="eyebrow">Market Research Report</div>
  <div class="report-title">${esc(sector.name)}</div>
  ${sector.sub ? `<div class="report-sub">${esc(sector.sub)}</div>` : ''}

  <div class="meta-row">
    <span class="meta-label">Score ETRA:</span>
    <span class="meta-score">${sector.score}</span>
    <span class="meta-tier">${t}</span>
  </div>

  ${sector.reco?.verdict ? `<div class="verdict-box"><p>${esc(sector.reco.verdict)}</p></div>` : ''}

  ${execSummaryHtml ? `<h2>Resumen ejecutivo</h2>${execSummaryHtml}` : ''}

  ${formatSections ? `<h2>Análisis por formato</h2>${formatSections}` : ''}

  ${capexHtml ? `<h2>CapEx y stickiness</h2>${capexHtml}` : ''}

  ${(sector.reco?.risks?.length ?? 0) > 0 ? `<h2>Factores de riesgo</h2>${riskTable(sector.reco.risks)}` : ''}

  ${recoHtml ? `<h2>Recomendación de inversión</h2>${recoHtml}` : ''}

  <div class="footer">
    Este documento es de uso interno exclusivo de ETRA Legacy Fund.<br>
    No distribuir sin autorización de Intus Capital.<br>
    ETRA Legacy Fund &nbsp;·&nbsp; Market Research Report &nbsp;·&nbsp; ${reportDate}
  </div>

</div>
</body>
</html>`;
}
