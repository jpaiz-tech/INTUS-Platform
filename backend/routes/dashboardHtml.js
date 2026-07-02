import express from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../utils/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadB64(filename) {
  try { return readFileSync(path.join(__dirname, '../assets', filename)).toString('base64'); }
  catch { return ''; }
}
const LOGO_INTUS_B64 = loadB64('logo-intus-white.png');
const LOGO_ETRA_B64  = loadB64('logo-etra.png');

export const dashboardHtmlRouter = express.Router();

const scoreColor = s => s >= 75 ? '#2D6A35' : s >= 60 ? '#B8893A' : '#8E3A3A';
const tier       = s => s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D';
const tierClass  = s => s >= 85 ? 't-Ap' : s >= 75 ? 't-A' : s >= 60 ? 't-B' : s >= 45 ? 't-C' : 't-D';

const ARCH_TYPES = ['Industrial', 'Retail', 'Oficinas'];
const ARCH_META  = {
  Industrial: {
    eyebrow: 'INDUSTRIAL',
    name: 'Parque Industrial Multi-Inquilino',
    sub: 'Torres · frío · médico · distribución',
    verdict: 'El tipo de activo con mayor densidad de sectores de alocación primaria. Torres telecomunicaciones y cold chain médico-farmacéutico lideran por adhesión estructural y crédito institucional. Mix con menor correlación a ciclos económicos adversos.',
  },
  Retail: {
    eyebrow: 'RETAIL STANDALONE · SINGLE-TENANT',
    name: 'Retail Standalone — Inquilino Único NNN',
    sub: 'Solo anclas esenciales con crédito institucional',
    verdict: 'El anchor determina la calidad del activo. El mix inline es secundario y depende del tráfico generado por la ancla. Sin anchor de calificación primaria, el formato no se sostiene dentro del mandato.',
  },
  Oficinas: {
    eyebrow: 'OFICINAS · HQ CORPORATIVO',
    name: 'Edificio Corporativo — HQ + Servicios',
    sub: 'Sedes regionales ancla + servicios profesionales',
    verdict: 'Las sedes HQ aportan leases de 10–15 años con crédito institucional y alta adhesión estructural. El mix de regulados y multinacionales reduce la volatilidad del flujo. Formato viable en mercados con oferta de oficinas clase A estabilizada.',
  },
};

const DIM_HEADERS = [
  { label: 'DURABILIDAD', pct: '27%' },
  { label: 'SOLIDEZ',     pct: '22%' },
  { label: 'ADHESIÓN',    pct: '18%' },
  { label: 'SOLVENCIA',   pct: '16%' },
  { label: 'RESILIENCIA', pct: '17%' },
];

const WBAR_DIMS = [
  { key: 'd1', label: 'DURABILIDAD', pct: '27%', items: [
    'Éxito del sector a largo plazo (horizonte 10+ años)',
    'Resistencia a avances globales: IA, ecommerce, automatización',
    'Tendencias seculares de demanda · viabilidad del modelo de negocio',
    'Riesgo regulatorio estructural · tendencia secular de demanda',
  ]},
  { key: 'd2', label: 'SOLIDEZ', pct: '22%', items: [
    'Durabilidad del modelo de negocio',
    'Previsibilidad de ingresos',
    'Posición competitiva del operador',
    'Penaliza si el sector es predominantemente independientes',
  ]},
  { key: 'd3', label: 'ADHESIÓN', pct: '18%', items: [
    'Probabilidad de renovación',
    'Costo de fit-out y adhesión a la ubicación',
    'Criticidad del espacio para la operación',
    'Facilidad de re-arrendamiento si el inquilino sale',
  ]},
  { key: 'd4', label: 'SOLVENCIA', pct: '16%', items: [
    'Calidad crediticia del inquilino',
    'Disponibilidad de garantía corporativa',
    'Solidez del balance general',
    'Tasa histórica de incumplimiento',
  ]},
  { key: 'd5', label: 'RESILIENCIA', pct: '17%', items: [
    'Riesgo y capacidad de sobrevivir shocks de corto plazo',
    'Riesgo de cierre forzado (pandemia / evento)',
    'Desempeño en recesión · demanda esencial vs. discrecional',
  ]},
];

function buildRankList(sectors) {
  return sectors.map((s, i) => {
    const sc = scoreColor(s.score);
    const tc = tierClass(s.score);
    const t  = tier(s.score);
    return `
    <div class="rank-row">
      <div class="rank-num">${i + 1}</div>
      <div class="rank-name-wrap">
        <div class="rank-name">${s.name}</div>
        ${s.sub ? `<div class="rank-sub">${s.sub}</div>` : ''}
      </div>
      <div class="rank-track"><div class="rank-fill" style="width:${s.score}%;background:${sc}"></div></div>
      <div class="rank-score" style="color:${sc}">${s.score}</div>
      <span class="rank-tier ${tc}">${t}</span>
    </div>`;
  }).join('');
}

// Returns format-specific score for a sector given an asset type.
function archFormatScore(s, assetType) {
  const d   = s.sector_data || {};
  const raw = assetType.toLowerCase();
  const key = raw === 'oficinas' ? 'office' : raw;
  const tab = (d.tabs || []).find(t =>
    ((t.assets && t.assets[0] ? t.assets[0].label : '') + ' ' + (t.shortLabel || ''))
      .toLowerCase().includes(key)
  );
  if (tab) {
    const chip = (d.assetChips || []).find(c => c.label === tab.shortLabel);
    if (chip && !chip.pending && chip.score != null) return chip.score;
    if (tab.score != null) return tab.score;
  }
  return s.score_exact ?? s.score;
}

function buildArchGrid(sectors) {
  const cards = ARCH_TYPES.map(assetType => {
    const meta     = ARCH_META[assetType];
    const matching = sectors
      .filter(s => Array.isArray(s.assets) && s.assets.includes(assetType))
      .sort((a, b) => archFormatScore(b, assetType) - archFormatScore(a, assetType));
    if (!matching.length) return null;
    const avg = Math.round(matching.reduce((sum, s) => sum + archFormatScore(s, assetType), 0) / matching.length);
    const sc  = scoreColor(avg);
    const t   = tier(avg);
    const comps = matching.slice(0, 5).map((s, i) => `
      <div class="arch-comp">
        <span class="ac-rank">${i + 1}</span>
        <span>${s.name}${s.sub ? ` — ${s.sub.split('—')[0].trim()}` : ''}</span>
        <span class="ac-s">${Math.round(archFormatScore(s, assetType))}</span>
      </div>`).join('');
    return `
    <div class="arch-card">
      <div class="arch-eyebrow">${meta.eyebrow}</div>
      <div class="arch-head">
        <div class="arch-name">${meta.name}<br><span style="font-weight:400;font-size:14px;color:var(--w60)">${meta.sub}</span></div>
        <div class="arch-score" style="color:${sc}">${avg}<small>TIER ${t}</small></div>
      </div>
      <div class="arch-comps">${comps}</div>
      <div class="arch-avg">
        <span class="arch-avg-label">promedio</span>
        <span class="arch-avg-score">${avg}</span>
      </div>
      <div class="arch-verdict">${meta.verdict}</div>
    </div>`;
  }).filter(Boolean).join('');
  return `<div class="arch-grid">${cards}</div>`;
}

function buildScoringTable(sectors) {
  const dimHeaders = DIM_HEADERS.map(h =>
    `<th>${h.label}<br><span style="opacity:.5;font-size:11px">${h.pct}</span></th>`
  ).join('');

  const rows = sectors.map((s, idx) => {
    const d         = s.sector_data || {};
    const sc        = scoreColor(s.score);
    const tc        = tierClass(s.score);
    const t         = tier(s.score);
    const hasDetail = !!(d.hasDetail || (d.tabs && d.tabs.length > 0));
    const primary   = d.dimScores?.[0];

    const dimCells = DIM_HEADERS.map((_, di) => {
      if (!primary) return `<td class="dim-cell"><span class="dim-pending">—</span></td>`;
      const v   = primary.scores?.[di];
      const c   = v != null ? scoreColor(v) : '#aaa';
      const avg = v != null ? (v / 10).toFixed(1) : '—';
      return `<td class="dim-cell">
        <div class="dim-score-main" style="color:${c}">${v ?? '—'}</div>
        <div class="dim-avg-label">avg ${avg}/10</div>
      </td>`;
    }).join('');

    const assets = (s.assets || []).map(a => `<span class="atag">${a}</span>`).join('');

    // Spa chips: score per format
    let spaChips = '';
    if (d.dimScores && d.dimScores.length > 0) {
      spaChips = d.dimScores.map(rt => {
        const chip = (d.assetChips || []).find(ac =>
          ac.label.toLowerCase().includes(rt.label.toLowerCase())
        );
        const s2  = chip && !chip.pending ? chip.score : s.score;
        const c2  = chip && !chip.pending ? scoreColor(s2) : scoreColor(s.score);
        const tc2 = chip && !chip.pending ? tierClass(s2) : tierClass(s.score);
        const t2  = chip && !chip.pending ? tier(s2) : tier(s.score);
        return `<div class="spa-chip">
          <span class="spa-chip-label">${rt.label.toUpperCase()}</span>
          <span class="spa-chip-score" style="color:${c2}">${s2}</span>
          <span class="rank-tier ${tc2}" style="font-size:12px;padding:1px 5px;color:${c2};border-color:${c2}50">${t2}</span>
        </div>`;
      }).join('');
    } else {
      const assetLabel = (s.assets || [])[0] || '';
      spaChips = `<div class="spa-chip">
        <span class="spa-chip-label">${assetLabel.toUpperCase()}</span>
        <span class="spa-chip-score" style="color:${sc}">${s.score}</span>
        <span class="rank-tier ${tc}" style="font-size:12px;padding:1px 5px">${t}</span>
      </div>`;
    }

    const clickAttr = hasDetail ? `onclick="toggleRow(${idx})" style="cursor:pointer"` : '';
    const chevron   = hasDetail ? `<span class="row-chevron" style="font-size:13px;color:var(--green);margin-left:6px;opacity:.7">▸</span>` : '';

    return `
    <tr class="sector-row" data-idx="${idx}" ${clickAttr}>
      <td>
        <div class="ind-name">${s.name}${chevron}</div>
        <div class="ind-sub">${s.sub || ''}</div>
      </td>
      ${dimCells}
      <td class="final-cell">
        <div class="final-box" style="border-color:${sc}60;background:${sc}08">
          <div class="final-num" style="color:${sc}">${s.score}</div>
          <div class="final-sub">/ 100</div>
        </div>
      </td>
      <td style="text-align:center"><span class="rank-tier ${tc}">${t}</span></td>
      <td>${assets}</td>
    </tr>
    <tr class="spa-row" data-idx="${idx}">
      <td colspan="9" style="padding:0;border-bottom:1px solid var(--border)">
        <div class="spa-inner">
          <span class="spa-label">Score por formato</span>
          ${spaChips}
        </div>
      </td>
    </tr>
    <tr class="expand-row" data-idx="${idx}" style="display:none">
      <td colspan="9" class="expand-td">
        <div class="expand-inner" id="expand-inner-${idx}"></div>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="slabel">Matriz de scoring — haga clic en una fila para ver el detalle</div>
  <div class="pending-note">
    Sub-criterios cargados para todos los sectores detallados · cadena de cálculo determinística:
    sub-criterios → dimensión (promedio ×10) → score por formato (ponderado) → compuesto (promedio entre formatos, ponderado)
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="left" style="width:200px">Industria / Sector</th>
          ${dimHeaders}
          <th>SCORE</th>
          <th>TIER</th>
          <th>ACTIVO</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function generateDashboardHTML(sectors, generatedAt) {
  const dateStr = new Date(generatedAt).toLocaleDateString('es-PA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const wbarSegs  = WBAR_DIMS.map(d =>
    `<div class="wbar-seg wbar-${d.key}">${d.label} <span class="wbar-pct">${d.pct}</span></div>`
  ).join('');
  const wbarCards = WBAR_DIMS.map(d =>
    `<div class="wbar-card wbar-card-${d.key}"><ul>${d.items.map(item => `<li>${item}</li>`).join('')}</ul></div>`
  ).join('');

  const tierLegend = [
    { cls: 't-Ap', label: 'A+', desc: '≥ 85  Prioridad máxima' },
    { cls: 't-A',  label: 'A',  desc: '≥ 75  Allocación primaria' },
    { cls: 't-B',  label: 'B',  desc: '≥ 60  Condicional' },
    { cls: 't-C',  label: 'C',  desc: '≥ 45  Solo componente' },
    { cls: 't-D',  label: 'D',  desc: '< 45  Evitar' },
  ].map(t =>
    `<div class="tleg-item"><span class="rank-tier ${t.cls}">${t.label}</span> ${t.desc}</div>`
  ).join('');

  const logoIntusImg = LOGO_INTUS_B64
    ? `<img src="data:image/png;base64,${LOGO_INTUS_B64}" class="brand-logo-intus" alt="Intus">`
    : `<span style="font-family:Verdana,sans-serif;font-size:16px;font-weight:700;color:#F4F0E6">INTUS CAPITAL</span>`;
  const logoEtraImg = LOGO_ETRA_B64
    ? `<img src="data:image/png;base64,${LOGO_ETRA_B64}" class="brand-logo-etra" alt="ETRA">`
    : '';

  // Embed full sector_data objects for JS interactivity
  const sectorsJSON = JSON.stringify(sectors.map(s => s.sector_data || {}))
    .replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ETRA Legacy Fund — Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --teal:#F4F0E6;
  --green:#A88B4F;
  --white:#0D1F33;
  --w60:#3A4E5E;
  --w20:rgba(13,31,51,.15);
  --w08:rgba(13,31,51,.08);
  --border:rgba(13,31,51,.22);
}
body{background:var(--teal);color:var(--white);font-family:Cambria,Georgia,serif;font-size:16px;line-height:1.6}

/* topbar */
.topbar{background:#0D1F33;padding:14px 32px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px}
.topbar-left{display:flex;align-items:center;justify-content:flex-start;flex-shrink:0}
.topbar-center{text-align:center}
.topbar-center-title{font-family:Verdana,sans-serif;font-size:17px;font-weight:700;color:#F4F0E6;letter-spacing:1px}
.topbar-center-sub{font-family:Verdana,sans-serif;font-size:12px;font-weight:400;letter-spacing:.5px;white-space:nowrap;color:rgba(244,240,230,.55)}
.topbar-right{display:flex;align-items:center;justify-content:flex-end;flex-shrink:0;gap:12px}
.topbar-badge{font-family:Verdana,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(244,240,230,.45);border:1px solid rgba(244,240,230,.15);padding:3px 8px;border-radius:2px}
.brand-logo-intus{height:54px;width:auto;display:block}
.brand-logo-etra{height:70px;width:auto;display:block}

/* main */
.main{padding:28px 32px}
.slabel{font-family:Verdana,sans-serif;font-size:13px;letter-spacing:2.5px;text-transform:uppercase;color:var(--green);margin-bottom:12px;display:flex;align-items:center;gap:10px}
.slabel::after{content:'';flex:1;height:1px;background:var(--border)}

/* wbar */
.wbar{display:grid;grid-template-columns:27fr 22fr 18fr 16fr 17fr;border:1px solid var(--border);border-radius:2px;overflow:hidden;margin-bottom:8px}
.wbar-seg{padding:7px 12px;font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--w60);white-space:nowrap}
.wbar-pct{opacity:.5;font-size:12px}
.wbar-d1{background:rgba(168,139,79,.10);border-right:1px solid var(--border)}
.wbar-d2{background:rgba(13,31,51,.04);border-right:1px solid var(--border)}
.wbar-d3{background:rgba(168,139,79,.06);border-right:1px solid var(--border)}
.wbar-d4{background:rgba(13,31,51,.04);border-right:1px solid var(--border)}
.wbar-d5{background:rgba(168,139,79,.04)}
.wbar-cards{display:grid;grid-template-columns:27fr 22fr 18fr 16fr 17fr;border:1px solid var(--border);border-radius:2px;border-top:none;overflow:hidden;margin-bottom:24px}
.wbar-card{padding:10px 10px 12px;border-right:1px solid var(--border)}
.wbar-card:last-child{border-right:none}
.wbar-card ul{list-style:none;display:flex;flex-direction:column;gap:4px}
.wbar-card ul li{font-size:14px;line-height:1.4;color:var(--w60);padding-left:13px;position:relative}
.wbar-card ul li::before{content:'·';position:absolute;left:2px;color:var(--green);font-size:17px;line-height:1.2}
.wbar-card-d1{background:rgba(168,139,79,.04)}
.wbar-card-d2{background:rgba(13,31,51,.02)}
.wbar-card-d3{background:rgba(168,139,79,.02)}
.wbar-card-d4{background:rgba(13,31,51,.02)}
.wbar-card-d5{background:rgba(168,139,79,.02)}

/* tier legend */
.tier-legend{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px;font-family:Verdana,sans-serif;font-size:13.5px;color:var(--w60)}
.tleg-item{display:flex;align-items:center;gap:6px}

/* rank */
.rank-list{display:flex;flex-direction:column;gap:9px;margin-bottom:36px}
.rank-row{display:grid;grid-template-columns:22px 230px 1fr 34px 36px;align-items:center;gap:10px}
.rank-num{font-family:Verdana,sans-serif;font-size:13px;color:var(--w60);text-align:right;opacity:.4}
.rank-name{font-family:Verdana,sans-serif;font-size:15px;font-weight:700;color:var(--white)}
.rank-sub{font-size:13px;color:var(--w60)}
.rank-track{height:6px;background:var(--w08);border-radius:3px;overflow:hidden}
.rank-fill{height:100%;border-radius:3px}
.rank-score{font-family:Verdana,sans-serif;font-weight:700;font-size:17px;text-align:right}
.rank-tier{display:inline-flex;align-items:center;justify-content:center;font-family:Verdana,sans-serif;font-size:13px;font-weight:700;padding:2px 7px;border:1px solid;border-radius:2px;letter-spacing:.5px}
.t-Ap{color:#2D5E32;border-color:rgba(45,94,50,.40);background:rgba(45,94,50,.09)}
.t-A{color:#4A6B4E;border-color:rgba(74,107,78,.40);background:rgba(74,107,78,.09)}
.t-B{color:#B8893A;border-color:rgba(184,137,58,.40);background:rgba(184,137,58,.09)}
.t-C{color:#A0522A;border-color:rgba(160,82,42,.40);background:rgba(160,82,42,.09)}
.t-D{color:#8E3A3A;border-color:rgba(142,58,58,.40);background:rgba(142,58,58,.09)}

/* arch */
.arch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin-bottom:36px}
.arch-card{border:1px solid var(--border);border-radius:2px;background:rgba(13,31,51,.02);padding:16px 16px 14px}
.arch-eyebrow{font-family:Verdana,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--green);margin-bottom:6px;opacity:.8}
.arch-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.arch-name{font-family:Cambria,serif;font-size:15px;font-weight:700;color:var(--white);line-height:1.35}
.arch-score{font-family:Verdana,sans-serif;font-weight:700;font-size:28px;line-height:1;text-align:right;flex-shrink:0;margin-left:12px}
.arch-score small{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.6;font-weight:400;margin-top:2px}
.arch-comps{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
.arch-comp{display:grid;grid-template-columns:18px 1fr 30px;align-items:center;gap:6px;font-size:14px;color:var(--w60)}
.arch-comp .ac-rank{font-family:Consolas,monospace;font-size:13px;color:var(--w60);opacity:.4;text-align:right}
.arch-comp .ac-s{font-family:Verdana,sans-serif;font-weight:700;font-size:14.5px;text-align:right;color:var(--white)}
.arch-avg{display:flex;justify-content:space-between;align-items:baseline;padding-top:8px;margin-top:2px;border-top:1px solid var(--border)}
.arch-avg-label{font-family:Verdana,sans-serif;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--w60)}
.arch-avg-score{font-family:Verdana,sans-serif;font-weight:700;font-size:18px;color:var(--green)}
.arch-verdict{font-family:Cambria,serif;font-style:italic;font-size:14.5px;color:var(--w60);line-height:1.5;border-top:1px solid var(--w20);padding-top:9px;margin-top:10px}

/* table */
.table-wrap{overflow-x:auto;margin-bottom:40px}
table{width:100%;border-collapse:collapse;min-width:960px}
thead th{background:#0D1F33;border-bottom:2px solid var(--green);padding:9px 12px;text-align:center;font-family:Verdana,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(244,240,230,.75);white-space:nowrap}
thead th.left{text-align:left}
td{padding:12px;vertical-align:middle}
tbody tr.sector-row{border-bottom:none;transition:background .1s}
tbody tr.sector-row:hover{background:var(--w08)}
tbody tr.sector-row.is-expanded{background:rgba(168,139,79,.04)}
tbody tr.spa-row.is-expanded{background:rgba(168,139,79,.04)}
.ind-name{font-family:Verdana,sans-serif;font-size:15.5px;font-weight:700;color:var(--white);margin-bottom:3px}
.ind-sub{font-size:14px;color:var(--w60)}
.dim-cell{text-align:center;padding:10px 8px !important}
.dim-score-main{font-family:Verdana,sans-serif;font-size:26px;font-weight:700;line-height:1;margin-bottom:4px}
.dim-avg-label{font-family:Verdana,sans-serif;font-size:13px;color:var(--w60);letter-spacing:.2px}
.dim-pending{font-family:Verdana,sans-serif;font-size:22px;color:var(--w20);letter-spacing:1px}
.final-cell{text-align:center}
.final-box{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:52px;height:52px;border:1.5px solid;border-radius:2px}
.final-num{font-family:Verdana,sans-serif;font-size:22px;font-weight:700;line-height:1}
.final-sub{font-family:Verdana,sans-serif;font-size:12px;letter-spacing:.5px;margin-top:2px;opacity:.5}
.atag{display:inline-block;padding:2px 6px;border:1px solid var(--border);border-radius:2px;font-family:Verdana,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.3px;color:var(--w60);margin:1px 2px}
.pending-note{font-family:Verdana,sans-serif;font-size:13px;letter-spacing:.4px;color:var(--w60);opacity:.5;font-style:italic;text-align:center;padding:4px 0 10px}

/* spa row */
.spa-inner{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 20px}
.spa-label{font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--w60);white-space:nowrap;margin-right:4px}
.spa-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);padding:3px 10px;border-radius:2px}
.spa-chip-label{font-family:Verdana,sans-serif;font-size:13px;color:var(--w60);letter-spacing:.3px}
.spa-chip-score{font-family:Verdana,sans-serif;font-size:16px;font-weight:700}

/* expand panel */
.expand-td{padding:0 !important;border:none !important;border-bottom:2px solid var(--green) !important}
.expand-inner{padding:24px 32px 28px;background:#EBE7DD;border-top:1px solid var(--border)}
.tab-bar{display:flex;gap:0;margin-bottom:20px;border-bottom:1px solid var(--border)}
.tab-btn{font-family:Verdana,sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:none;border:none;border-bottom:2px solid transparent;padding:8px 14px 9px;cursor:pointer;color:var(--w60);margin-bottom:-1px;display:flex;align-items:center;gap:6px;transition:color .1s}
.tab-btn:hover{color:var(--white)}
.tab-btn.active{color:var(--white);border-bottom-color:var(--green)}
.tab-score-badge{font-family:Verdana,sans-serif;font-size:12px;font-weight:700;border:1px solid;border-radius:2px;padding:1px 6px;letter-spacing:.5px}
.dim-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px}
.dim-card{background:rgba(13,31,51,.03);border:1px solid var(--border);border-radius:2px;padding:14px}
.dim-card.hi{border-color:rgba(168,139,79,.35);background:rgba(168,139,79,.04)}
.dim-card-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.dim-card-label{font-family:Verdana,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--w60)}
.dim-card-score{font-family:Verdana,sans-serif;font-size:22px;font-weight:700;line-height:1}
.dim-bar-wrap{height:3px;background:var(--w08);border-radius:2px;overflow:hidden;margin-bottom:12px}
.dim-bar-fill{height:100%;border-radius:2px}
.sub-list{display:flex;flex-direction:column;gap:10px}
.sub-item{display:flex;gap:10px;align-items:flex-start}
.sub-pill{flex-shrink:0;font-family:Verdana,sans-serif;font-size:12px;font-weight:700;padding:2px 6px;border-radius:2px;letter-spacing:.3px}
.sp-hi{background:rgba(45,94,50,.12);color:#2D5E32}
.sp-md{background:rgba(184,137,58,.12);color:#B8893A}
.sp-lo{background:rgba(142,58,58,.12);color:#8E3A3A}
.sub-cname{font-family:Verdana,sans-serif;font-size:13px;font-weight:700;color:var(--white);margin-bottom:2px}
.sub-cnote{font-size:13px;color:var(--w60);line-height:1.5}
.sub-content-full{flex:1}
.space-crit-badge{display:inline-block;font-family:Verdana,sans-serif;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:2px;margin:3px 0 5px}
.sc-mission{background:#1a6e35;color:#fff}
.sc-important{background:#7a5c14;color:#fff}
.sc-substitute{background:#8B2C2C;color:#fff}
.tag-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;opacity:.5;margin-right:5px}
.asset-chips-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.asset-chips-label{font-family:Verdana,sans-serif;font-size:12.5px;letter-spacing:1px;text-transform:uppercase;color:var(--w60)}
.asset-chip-full{display:flex;align-items:center;gap:8px;border:1px solid var(--border);padding:5px 12px;border-radius:2px}
.afc-label{font-size:14px;color:var(--w60)}
.afc-score{font-family:Verdana,sans-serif;font-size:18px;font-weight:700}
.reco-box{margin-top:18px;padding:14px 16px;background:rgba(168,139,79,.04);border:1px solid rgba(168,139,79,.2);border-radius:2px}
.reco-label{font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--green);margin-bottom:8px}
.reco-text{font-size:15px;color:var(--w60);line-height:1.7}
.reco-verdict{margin-top:10px;padding:8px 12px;background:rgba(45,94,50,.07);border-left:2px solid #2D5E32;font-family:Verdana,sans-serif;font-size:14px;font-weight:700;color:#2D5E32;letter-spacing:.3px}
.risk-section{margin-top:18px}
.risk-label{font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--w60);margin-bottom:8px}
.risk-table{width:100%;border-collapse:collapse}
.risk-table thead th{background:rgba(244,240,230,.03);border-bottom:1px solid var(--border);padding:6px 10px;text-align:left;font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--w60);white-space:nowrap}
.risk-table tbody tr{border-bottom:1px solid rgba(244,240,230,.05)}
.risk-table tbody td{padding:7px 10px;font-size:14px;color:var(--w60);vertical-align:top;line-height:1.5}
.risk-table tbody td:first-child{color:var(--white);font-weight:500}
.risk-prob-hi{color:#8E3A3A!important;font-weight:600}
.risk-prob-mid{color:#B8893A!important;font-weight:600}
.risk-prob-lo{color:#4A6B4E!important;font-weight:600}
.risk-impact-hi{color:#8E3A3A!important}
.risk-impact-mid{color:#B8893A!important}
.capex-note-section{margin-top:14px;padding:11px 14px;background:rgba(13,31,51,.04);border-left:2px solid rgba(168,139,79,.5)}
.capex-note-label{font-family:Verdana,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--green);margin-bottom:7px}
.capex-note-text{font-size:14px;color:var(--w60);line-height:1.65}

.dashboard-meta{font-family:Verdana,sans-serif;font-size:11px;color:var(--w60);opacity:.5;text-align:right;padding:12px 0 4px}

@media print{body{background:var(--teal)}.main{padding:20px 28px}}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">${logoIntusImg}</div>
  <div class="topbar-center">
    <div class="topbar-center-title">ETRA Legacy Fund</div>
    <div class="topbar-center-sub">Industry Scoring &amp; Analysis</div>
  </div>
  <div class="topbar-right">
    ${logoEtraImg}
    <span class="topbar-badge">Generado ${dateStr}</span>
  </div>
</div>

<div class="main">

  <div class="slabel">Marco de scoring — 6 dimensiones ponderadas</div>
  <div class="wbar">${wbarSegs}</div>
  <div class="wbar-cards">${wbarCards}</div>

  <div class="tier-legend">${tierLegend}</div>

  <div class="slabel">Ranking — Score compuesto</div>
  <div class="rank-list">${buildRankList(sectors)}</div>

  <div class="slabel">Ranking por tipo de activo</div>
  <p style="font-family:Cambria,serif;font-style:italic;font-size:15px;color:#3A4E5E;margin:-4px 0 14px;max-width:880px;line-height:1.5">
    Cada tipo de activo agrupa los sectores con presencia en ese formato, ordenados por score compuesto.
    El promedio refleja la calidad del mix de inquilinos típico para ese tipo de inmueble.
  </p>
  ${buildArchGrid(sectors)}

  ${buildScoringTable(sectors)}

</div>

<script>
var SECTORS = ${sectorsJSON};
var currentOpen = null;
var tabState = {};

function sc(s){return s>=75?'#2D6A35':s>=60?'#B8893A':'#8E3A3A';}
function tier(s){return s>=85?'A+':s>=75?'A':s>=60?'B':s>=45?'C':'D';}
function tierCls(s){return s>=85?'t-Ap':s>=75?'t-A':s>=60?'t-B':s>=45?'t-C':'t-D';}
function spCls(v){return v>=8?'sp-hi':v>=6?'sp-md':'sp-lo';}

function probCls(p){return /alto/i.test(p)?'risk-prob-hi':/bajo/i.test(p)?'risk-prob-lo':'risk-prob-mid';}
function impCls(p){return /alto/i.test(p)?'risk-impact-hi':'risk-impact-mid';}

function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderExpandPanel(d, container, activeTab){
  activeTab = activeTab || 0;
  var tabs = d.tabs || [];
  var tab  = tabs[activeTab] || null;
  var html = '';

  // Tab bar
  if(tabs.length > 0){
    html += '<div class="tab-bar">';
    tabs.forEach(function(t, ti){
      var color = sc(t.score);
      var cls = ti === activeTab ? ' active' : '';
      html += '<button class="tab-btn'+cls+'" onclick="switchTab('+d._idx+','+ti+')">'
        + escHtml(t.shortLabel)
        + '<span class="tab-score-badge" style="color:'+color+';border-color:'+color+'50">'+t.score+'</span>'
        + '</button>';
    });
    html += '</div>';
  }

  // Dim grid
  if(tab && tab.dims){
    html += '<div class="dim-grid">';
    tab.dims.forEach(function(dim, di){
      var color = dim.color || sc(dim.score);
      var hiCls = di === 0 ? ' hi' : '';
      html += '<div class="dim-card'+hiCls+'">'
        + '<div class="dim-card-head">'
        + '<div class="dim-card-label">'+escHtml(dim.label)+'</div>'
        + '<div class="dim-card-score" style="color:'+color+'">'+dim.score+'</div>'
        + '</div>'
        + '<div class="dim-bar-wrap"><div class="dim-bar-fill" style="width:'+dim.score+'%;background:'+color+'"></div></div>'
        + '<div class="sub-list">';
      (dim.subs || []).forEach(function(sub){
        var crit = sub.spaceCriticality;
        if(crit){
          html += '<div class="sub-item">'
            + '<div class="sub-content-full">'
            + '<div class="sub-cname">'+escHtml(sub.n)+'</div>'
            + '<div class="space-crit-badge sc-'+escHtml(crit.level)+'">'+escHtml(crit.label)+'</div>'
            + '<div class="sub-cnote">'+(sub.tag?'<span class="tag-badge">['+escHtml(sub.tag)+']</span>':'')+escHtml(sub.note)+'</div>'
            + '</div></div>';
        } else {
          html += '<div class="sub-item">'
            + '<div class="sub-pill '+spCls(sub.s)+'">'+sub.s+'/10</div>'
            + '<div>'
            + '<div class="sub-cname">'+escHtml(sub.n)+'</div>'
            + '<div class="sub-cnote">'+(sub.tag?'<span class="tag-badge">['+escHtml(sub.tag)+']</span>':'')+escHtml(sub.note)+'</div>'
            + '</div></div>';
        }
      });
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Asset chips
  if(d.assetChips && d.assetChips.length > 0){
    html += '<div class="asset-chips-row"><span class="asset-chips-label">Score ajustado por activo</span>';
    d.assetChips.forEach(function(c){
      var color = c.pending ? 'var(--w60)' : sc(c.score);
      var tc2   = c.pending ? '' : tierCls(c.score);
      html += '<div class="asset-chip-full">'
        + '<span class="afc-label">'+escHtml(c.label)+'</span>'
        + '<span class="afc-score" style="color:'+color+'">'+(c.pending?'—':c.score)+'</span>'
        + (c.pending
            ? '<span style="font-size:13px;opacity:.5;font-style:italic">pendiente</span>'
            : '<span class="rank-tier '+tc2+'" style="font-size:12px;padding:1px 5px;color:'+color+';border-color:'+color+'50">'+tier(c.score)+'</span>')
        + '</div>';
    });
    html += '</div>';
  }

  // Risk table
  if(d.reco && d.reco.risks && d.reco.risks.length > 0){
    html += '<div class="risk-section"><div class="risk-label">Tabla de riesgos</div>'
      + '<table class="risk-table"><thead><tr>'
      + '<th style="width:34%">Riesgo</th><th>Tipo</th><th>Probabilidad</th><th>Impacto</th><th>Horizonte de disrupción</th>'
      + '</tr></thead><tbody>';
    d.reco.risks.forEach(function(r){
      html += '<tr>'
        + '<td>'+escHtml(r.risk)+'</td>'
        + '<td>'+escHtml(r.type)+'</td>'
        + '<td class="'+probCls(r.prob)+'">'+escHtml(r.prob)+'</td>'
        + '<td class="'+impCls(r.impact)+'">'+escHtml(r.impact)+'</td>'
        + '<td>'+escHtml(r.horizon)+'</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // CapEx note
  if(d.reco && d.reco.capexNote){
    html += '<div class="capex-note-section">'
      + '<div class="capex-note-label">Nota de CapEx</div>'
      + '<div class="capex-note-text">'+d.reco.capexNote+'</div>'
      + '</div>';
  }

  // Reco box
  if(d.reco && (d.reco.text || d.reco.verdict)){
    html += '<div class="reco-box"><div class="reco-label">Recomendación de inversión</div>'
      + (d.reco.text ? '<div class="reco-text">'+d.reco.text+'</div>' : '')
      + (d.reco.verdict ? '<div class="reco-verdict">'+escHtml(d.reco.verdict)+'</div>' : '')
      + '</div>';
  }

  container.innerHTML = html;
}

function toggleRow(idx){
  var d = SECTORS[idx];
  if(!d) return;
  var hasDetail = !!(d.hasDetail || (d.tabs && d.tabs.length > 0));
  if(!hasDetail) return;

  var expandRow = document.querySelector('.expand-row[data-idx="'+idx+'"]');
  var sectorRow = document.querySelector('.sector-row[data-idx="'+idx+'"]');
  var spaRow    = document.querySelector('.spa-row[data-idx="'+idx+'"]');
  var chevron   = sectorRow ? sectorRow.querySelector('.row-chevron') : null;

  if(currentOpen === idx){
    expandRow.style.display = 'none';
    if(sectorRow) sectorRow.classList.remove('is-expanded');
    if(spaRow)    spaRow.classList.remove('is-expanded');
    if(chevron)   chevron.textContent = '▸';
    currentOpen = null;
  } else {
    if(currentOpen !== null){
      var pRow = document.querySelector('.expand-row[data-idx="'+currentOpen+'"]');
      var pSec = document.querySelector('.sector-row[data-idx="'+currentOpen+'"]');
      var pSpa = document.querySelector('.spa-row[data-idx="'+currentOpen+'"]');
      var pChv = pSec ? pSec.querySelector('.row-chevron') : null;
      if(pRow) pRow.style.display = 'none';
      if(pSec) pSec.classList.remove('is-expanded');
      if(pSpa) pSpa.classList.remove('is-expanded');
      if(pChv) pChv.textContent = '▸';
    }
    expandRow.style.display = '';
    if(sectorRow) sectorRow.classList.add('is-expanded');
    if(spaRow)    spaRow.classList.add('is-expanded');
    if(chevron)   chevron.textContent = '▾';

    d._idx = idx;
    var container = document.getElementById('expand-inner-'+idx);
    if(container) renderExpandPanel(d, container, tabState[idx] || 0);
    currentOpen = idx;
    expandRow.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
}

function switchTab(idx, tabIdx){
  tabState[idx] = tabIdx;
  var d = SECTORS[idx];
  if(!d) return;
  d._idx = idx;
  var container = document.getElementById('expand-inner-'+idx);
  if(container) renderExpandPanel(d, container, tabIdx);
}
</script>
</body>
</html>`;
}

dashboardHtmlRouter.get('/', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  try {
    const { data: sectors, error } = await supabase
      .from('sectors')
      .select('name, score, score_exact, sub, assets, updated_at, sector_data')
      .order('score_exact', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    if (!sectors || sectors.length === 0)
      return res.status(404).json({ error: 'No sectors found' });

    const html     = generateDashboardHTML(sectors, new Date().toISOString());
    const filename = `etra-dashboard-${new Date().toISOString().slice(0, 10)}.html`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
