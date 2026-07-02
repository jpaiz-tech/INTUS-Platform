import { scoreColor, tier } from '../utils.js';
import { generateReportHtml } from '../utils/reportHtml.js';
import logoEtraUrl  from '../assets/logo-etra.png';
import logoIntusUrl from '../assets/logo-intus.png';

const DIMS        = ['DURABILIDAD', 'SOLIDEZ', 'ADHESIÓN', 'SOLVENCIA', 'RESILIENCIA'];
const CONNECTORS  = ['', 'Adicionalmente, ', 'En este contexto, ', 'Respecto a la operación, ', 'Por otro lado, '];

// ── fallback prose builder (used when Agent 4 sections are not available) ──

function dimOpener(name, score) {
  const lvl = score >= 80 ? 'alta' : score >= 70 ? 'adecuada' : score >= 60 ? 'moderada' : 'limitada';
  switch (name) {
    case 'DURABILIDAD': return `La durabilidad estructural de este formato es ${lvl}, lo que refleja la capacidad del sector para mantenerse operativamente relevante durante el horizonte del fondo.`;
    case 'SOLIDEZ':     return `La solidez operativa y financiera del operador tipo es ${lvl}, ponderando la escala del negocio, sus márgenes y su historial de continuidad.`;
    case 'ADHESIÓN':    return `La adhesión al espacio físico —que captura la fricción de salida del arrendatario— es ${lvl}, determinada por la criticidad operativa del inmueble y el costo real de reubicación.`;
    case 'SOLVENCIA':   return `El perfil de solvencia del arrendatario tipo configura una capacidad de pago ${lvl} que incide directamente en la estabilidad del flujo de renta a largo plazo.`;
    case 'RESILIENCIA': return `La capacidad del sector para absorber shocks externos —macroeconómicos, regulatorios o tecnológicos— es ${lvl}, reflejando su exposición ante escenarios de estrés.`;
    default:            return `La dimensión ${name} presenta un desempeño ${lvl} en el contexto del sector analizado.`;
  }
}

function buildDimProse(dim, dimIdx) {
  const subs    = dim.subs || [];
  const dimName = (dim.label || DIMS[dimIdx] || '').toUpperCase();
  const score   = Math.round(dim.score);
  const opener  = dimOpener(dimName, score);
  if (!subs.length) return opener;
  const parts = subs.map(sub => {
    const note = (sub.note || '').replace(/\[(PROXY|VERIFIED|ESTIMATED|CALCULATED|SOURCE[DS]?)\]/gi, '').trim();
    const crit = sub.spaceCriticality;
    if (crit) {
      const lbl = crit.level === 'mission' ? 'de carácter misión crítica' : crit.level === 'substitute' ? 'sustituible con bajo costo de reubicación' : 'operacionalmente significativa';
      return `La <strong>${sub.n}</strong> es ${lbl}${note ? ` — ${note}` : ''}`;
    }
    return `<strong>${sub.n}</strong>${note ? `: ${note}` : ''}`;
  });
  const prose = parts.map((p, i) => i === 0 ? p : (CONNECTORS[i] || 'Asimismo, ') + p).join('. ');
  return `${opener} ${prose}.`;
}

// ── download ──────────────────────────────────────────────────────────────

async function toDataUrl(url) {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  } catch { return ''; }
}

async function downloadHtml(sector, dateIso) {
  const [logoEtra, logoIntus] = await Promise.all([toDataUrl(logoEtraUrl), toDataUrl(logoIntusUrl)]);
  const html = generateReportHtml(sector, dateIso, { logoEtra, logoIntus });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `etra-${(sector.name || 'report').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── shared styles ─────────────────────────────────────────────────────────

const PROSE = { fontSize: 14, lineHeight: 1.9, color: '#2A2A3E', margin: '0 0 14px 0', fontFamily: 'Georgia, serif' };
const H1    = { fontFamily: 'Verdana, sans-serif', fontSize: 13, fontWeight: 700, color: '#0D1F33', margin: '36px 0 14px', paddingBottom: 8, borderBottom: '2px solid #0D1F33', textTransform: 'uppercase', letterSpacing: 1 };
const H2    = { fontFamily: 'Verdana, sans-serif', fontSize: 12, fontWeight: 700, color: '#0D1F33', margin: '28px 0 12px', paddingBottom: 6, borderBottom: '1px solid #D8D8D8', letterSpacing: 0.5 };
const TH    = { padding: '9px 13px', textAlign: 'left', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, fontFamily: 'Verdana, sans-serif' };
const TD    = { padding: '9px 13px', color: '#2A2A3E', borderBottom: '1px solid #EBEBEB', fontSize: 13, verticalAlign: 'top', lineHeight: 1.55 };

// ── FormatSection ─────────────────────────────────────────────────────────

function FormatSection({ tab, agentSections }) {
  // Try to match Agent 4 sections for this format
  const a4 = agentSections?.find(f =>
    (f.formatName || '').toLowerCase().trim() === (tab.shortLabel || '').toLowerCase().trim()
  );

  const paragraphs = a4
    ? Object.values(a4.dimensionParagraphs || {}).filter(Boolean)
    : (tab.dims || []).map((dim, di) => buildDimProse(dim, di));

  return (
    <div style={{ marginBottom: 36 }}>
      <div style={H2}>{tab.shortLabel}</div>
      {paragraphs.map((p, i) => (
        <p key={i} style={PROSE} dangerouslySetInnerHTML={{ __html: p }} />
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────

export default function SectorReport({ sector, dateIso, showDownload = true }) {
  if (!sector) return null;

  const sc         = scoreColor(sector.score);
  const t          = tier(sector.score);
  const reportDate = new Date(dateIso || Date.now()).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });
  const rs         = sector.reportSections;          // Agent 4 narrative sections
  const hasTabs    = (sector.tabs?.length ?? 0) > 0;
  const hasRisks   = (sector.reco?.risks?.length ?? 0) > 0;

  // Executive summary: prefer Agent 4, fall back to reco.text
  const execSummaryHtml = rs?.executiveSummary || (sector.reco?.text ? `<p>${sector.reco.text}</p>` : null);
  // Verdict callout
  const verdict = sector.reco?.verdict;
  // CapEx: prefer Agent 4 narrative, fall back to raw note
  const capexHtml = rs?.capexNarrative || sector.reco?.capexNote || null;
  // Reco prose: prefer Agent 4, fall back to reco.text
  const recoHtml  = rs?.recoNarrative  || null;

  const paper = {
    background: '#fff',
    padding: '44px 56px 56px',
    fontFamily: 'Georgia, serif',
    color: '#2A2A3E',
    maxWidth: 860,
    margin: '0 auto',
  };

  return (
    <div style={paper}>

      {/* ── Page header bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #E0E0E0', marginBottom: 28 }}>
        <img src={logoEtraUrl} style={{ height: 30, width: 'auto', display: 'block' }} alt="ETRA Legacy Fund" />
        <span style={{ fontFamily: 'Verdana, sans-serif', fontSize: 10, color: '#8a9ab0', letterSpacing: 0.3 }}>
          Análisis de Industria &nbsp;·&nbsp; {reportDate}
        </span>
      </div>

      {/* ── Title block ── */}
      <div style={{ fontFamily: 'Verdana, sans-serif', fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: '#A88B4F', marginBottom: 10 }}>
        Market Research Report
      </div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: '#0D1F33', lineHeight: 1.2 }}>{sector.name}</div>
      {sector.sub && <div style={{ fontStyle: 'italic', color: '#5A6E7E', fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{sector.sub}</div>}

      {/* ── Meta row — score appears once, subtly ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 14, paddingBottom: 20, borderBottom: '1px solid #EBEBEB' }}>
        <span style={{ fontFamily: 'Verdana, sans-serif', fontSize: 11, color: '#8a9ab0' }}>Score ETRA:</span>
        <span style={{ fontFamily: 'Verdana, sans-serif', fontSize: 18, fontWeight: 700, color: sc }}>{sector.score}</span>
        <span style={{ fontFamily: 'Verdana, sans-serif', fontSize: 11, fontWeight: 700, padding: '2px 9px', border: `1.5px solid ${sc}`, borderRadius: 2, color: sc }}>{t}</span>
        {showDownload && (
          <button
            onClick={() => downloadHtml(sector, dateIso)}
            style={{ marginLeft: 'auto', fontFamily: 'Verdana, sans-serif', fontSize: 11, fontWeight: 600, padding: '6px 14px', background: 'transparent', border: '1px solid #A88B4F', borderRadius: 2, color: '#A88B4F', cursor: 'pointer' }}
          >
            ↓ Descargar
          </button>
        )}
      </div>

      {/* ── Verdict callout ── */}
      {verdict && (
        <div style={{ background: '#F8F7F4', borderLeft: '3px solid #A88B4F', padding: '14px 18px', margin: '24px 0 0', fontFamily: 'Verdana, sans-serif', fontStyle: 'italic', fontSize: 13, color: '#5A4A2E', lineHeight: 1.8 }}>
          {verdict}
        </div>
      )}

      {/* ── Executive Summary ── */}
      {execSummaryHtml && (
        <>
          <div style={H1}>Resumen ejecutivo</div>
          <div dangerouslySetInnerHTML={{ __html: execSummaryHtml }} style={{ fontSize: 14, lineHeight: 1.9, color: '#2A2A3E' }} />
        </>
      )}

      {/* ── Análisis por formato ── */}
      {hasTabs && (
        <>
          <div style={H1}>Análisis por formato</div>
          {sector.tabs.map((tab, ti) => (
            <FormatSection key={ti} tab={tab} agentSections={rs?.formatAnalysis} />
          ))}
        </>
      )}

      {/* ── CapEx y stickiness ── */}
      {capexHtml && (
        <>
          <div style={H1}>CapEx y stickiness</div>
          <div dangerouslySetInnerHTML={{ __html: capexHtml }} style={PROSE} />
        </>
      )}

      {/* ── Factores de riesgo ── */}
      {hasRisks && (
        <>
          <div style={H1}>Factores de riesgo</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, margin: '4px 0 0', fontFamily: 'Verdana, sans-serif' }}>
            <thead>
              <tr style={{ background: '#0D1F33', color: '#fff' }}>
                <th style={TH}>Riesgo</th>
                <th style={TH}>Tipo</th>
                <th style={TH}>Probabilidad</th>
                <th style={TH}>Impacto</th>
                <th style={TH}>Horizonte</th>
              </tr>
            </thead>
            <tbody>
              {sector.reco.risks.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8F7F4' }}>
                  <td style={{ ...TD, fontWeight: 500 }}>{r.risk}</td>
                  <td style={TD}>{r.type}</td>
                  <td style={{ ...TD, fontWeight: 600, color: /alto/i.test(r.prob) ? '#8E3A3A' : /bajo/i.test(r.prob) ? '#2D5E32' : '#B8893A' }}>{r.prob}</td>
                  <td style={{ ...TD, fontWeight: 600, color: /alto/i.test(r.impact) ? '#8E3A3A' : '#B8893A' }}>{r.impact}</td>
                  <td style={TD}>{r.horizon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Recomendación de inversión ── */}
      {(recoHtml || (!rs && sector.reco?.text)) && (
        <>
          <div style={H1}>Recomendación de inversión</div>
          <div dangerouslySetInnerHTML={{ __html: recoHtml || `<p>${sector.reco.text}</p>` }} style={{ fontSize: 14, lineHeight: 1.9, color: '#2A2A3E' }} />
        </>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop: 52, paddingTop: 14, borderTop: '1px solid #E0E0E0', fontFamily: 'Verdana, sans-serif', fontSize: 10, color: '#8a9ab0', textAlign: 'center', letterSpacing: 0.3, lineHeight: 2 }}>
        Este documento es de uso interno exclusivo de ETRA Legacy Fund.<br />
        No distribuir sin autorización de Intus Capital.<br />
        ETRA Legacy Fund · Market Research Report · {reportDate}
      </div>

    </div>
  );
}
