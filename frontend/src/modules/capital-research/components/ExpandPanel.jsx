import { useState } from 'react';
import { scoreColor, tier, subCls, IRO_MAP, probClass, impactClass } from '../utils.js';

const TIER_CLS = {
  'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  A:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  B:    'bg-amber-50 text-amber-700 border-amber-200',
  C:    'bg-orange-50 text-orange-700 border-orange-200',
  D:    'bg-red-50 text-red-600 border-red-200',
};

function TierBadge({ score, className = '' }) {
  const t = tier(score);
  return (
    <span className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 border rounded ${TIER_CLS[t] || 'bg-slate-50 text-slate-500 border-slate-200'} ${className}`}>
      {t}
    </span>
  );
}

const SUB_PILL_CLS = {
  'sp-hi': 'bg-emerald-50 text-emerald-700',
  'sp-md': 'bg-amber-50 text-amber-700',
  'sp-lo': 'bg-red-50 text-red-600',
};

const CRIT_BADGE_CLS = {
  mission:    'bg-emerald-600 text-white',
  important:  'bg-amber-600 text-white',
  substitute: 'bg-red-600 text-white',
};

const RISK_CLS = {
  'risk-prob-hi':    'text-red-600 font-semibold',
  'risk-prob-mid':   'text-amber-600 font-semibold',
  'risk-prob-lo':    'text-emerald-600 font-semibold',
  'risk-impact-hi':  'text-red-600',
  'risk-impact-mid': 'text-amber-600',
};

function DimCard({ dim, isFirst }) {
  const sc = dim.color || scoreColor(dim.score);
  return (
    <div className={`border rounded-lg p-3.5 ${isFirst ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex justify-between items-baseline mb-1.5">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{dim.label}</div>
        <div className="font-mono font-bold text-xl leading-none" style={{ color: sc }}>{dim.score}</div>
      </div>
      <div className="h-[3px] bg-slate-200/70 rounded overflow-hidden mb-3">
        <div className="h-full rounded" style={{ width: `${dim.score}%`, background: sc }} />
      </div>
      <div className="flex flex-col gap-2.5">
        {(dim.subs || []).map((sub, i) => {
          const crit = sub.spaceCriticality;
          return (
            <div className="flex gap-2.5 items-start" key={i}>
              {!crit && (
                <div className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${SUB_PILL_CLS[subCls(sub.s)] || ''}`}>{sub.s}/10</div>
              )}
              <div className={crit ? 'flex-1' : ''}>
                <div className="text-xs font-bold text-slate-800 mb-0.5">{sub.n}</div>
                {crit && (
                  <div className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded my-1 ${CRIT_BADGE_CLS[crit.level] || 'bg-slate-500 text-white'}`}>
                    {crit.label}
                  </div>
                )}
                <div className="text-xs text-slate-500 leading-relaxed">
                  {sub.tag && <span className="text-[10px] font-bold uppercase tracking-wide opacity-50 mr-1">[{sub.tag}]</span>}
                  {sub.note}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExpandPanel({ d, editMode, onDeleteTab }) {
  const [activeTab,     setActiveTab]     = useState(0);
  const [confirmTabIdx, setConfirmTabIdx] = useState(null);
  const [deletingTab,   setDeletingTab]   = useState(null);
  const [tabDeleteErr,  setTabDeleteErr]  = useState(null);

  const tabs = d.tabs || [];
  const tab  = tabs[activeTab] || null;

  async function confirmDeleteTab(shortLabel) {
    setDeletingTab(shortLabel);
    setTabDeleteErr(null);
    try {
      await onDeleteTab(d.name, shortLabel);
      setConfirmTabIdx(null);
      setActiveTab(0);
    } catch (err) {
      setTabDeleteErr(err.message);
    } finally {
      setDeletingTab(null);
    }
  }

  return (
    <div className="p-6 bg-slate-50 border-t border-slate-200">
      {tabs.length > 0 && (
        <div className="flex gap-0 mb-5 border-b border-slate-200">
          {tabs.map((t, ti) => {
            const sc = scoreColor(t.score);
            const assetLabel = t.assets && t.assets[0] ? t.assets[0].label : '';
            const iroLetter  = IRO_MAP[assetLabel] || IRO_MAP[t.shortLabel] || '';
            const isConfirm  = confirmTabIdx === ti;
            const isDeleting = deletingTab === t.shortLabel;
            return (
              <div key={ti} className="relative">
                <button
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3.5 py-2 -mb-px border-b-2 transition-colors ${ti === activeTab ? 'text-slate-800 border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-700'}`}
                  onClick={() => { if (!editMode) setActiveTab(ti); }}
                >
                  {t.shortLabel}
                  {iroLetter && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] font-bold">{iroLetter}</span>
                  )}
                  <span className="text-xs font-bold border rounded px-1.5 py-0.5" style={{ color: sc, borderColor: `${sc}50` }}>{t.score}</span>
                  {editMode && (
                    <span
                      className="text-slate-300 hover:text-red-500 font-bold px-1"
                      title={`Eliminar formato ${t.shortLabel}`}
                      onClick={e => { e.stopPropagation(); setConfirmTabIdx(ti); setTabDeleteErr(null); }}
                    >×</span>
                  )}
                </button>
                {isConfirm && (
                  <div className="absolute z-10 top-full left-0 mt-1 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg flex-wrap w-max max-w-xs" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-slate-600">
                      ¿Eliminar el formato <strong>{t.shortLabel}</strong> de <strong>{d.name}</strong>?
                    </span>
                    <button
                      className="bg-red-500 text-white rounded-lg text-xs font-semibold px-3 py-1.5 hover:bg-red-600 transition-all disabled:opacity-50"
                      onClick={() => confirmDeleteTab(t.shortLabel)}
                      disabled={isDeleting}
                    >{isDeleting ? 'Eliminando…' : 'Eliminar'}</button>
                    <button
                      className="border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-3 py-1.5 hover:border-emerald-300 hover:text-emerald-600 transition-all disabled:opacity-50"
                      onClick={() => setConfirmTabIdx(null)}
                      disabled={isDeleting}
                    >Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tabDeleteErr && (
        <div className="mt-1 mb-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {tabDeleteErr}
        </div>
      )}

      {tab && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-5">
          {(tab.dims || []).map((dim, di) => (
            <DimCard key={di} dim={dim} isFirst={di === 0} />
          ))}
        </div>
      )}

      {d.assetChips && d.assetChips.length > 0 && (
        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <span className="text-xs uppercase tracking-wide text-slate-400">Score ajustado por activo</span>
          {d.assetChips.map((c, i) => {
            const sc = c.pending ? undefined : scoreColor(c.score);
            return (
              <div className="flex items-center gap-2 border border-slate-200 px-3 py-1 rounded bg-white" key={i}>
                <span className="text-sm text-slate-500">{c.label}</span>
                <span className="font-mono font-bold text-lg" style={sc ? { color: sc } : undefined}>{c.pending ? '—' : c.score}</span>
                {c.pending
                  ? <span className="text-xs opacity-50 italic">pendiente</span>
                  : <TierBadge score={c.score} />
                }
              </div>
            );
          })}
        </div>
      )}

      {d.reco && d.reco.risks && d.reco.risks.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Tabla de riesgos</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 border-b border-slate-200 py-1.5 px-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap" style={{ width: '34%' }}>Riesgo</th>
                <th className="bg-slate-50 border-b border-slate-200 py-1.5 px-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Tipo</th>
                <th className="bg-slate-50 border-b border-slate-200 py-1.5 px-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Probabilidad</th>
                <th className="bg-slate-50 border-b border-slate-200 py-1.5 px-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Impacto</th>
                <th className="bg-slate-50 border-b border-slate-200 py-1.5 px-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">Horizonte de disrupción</th>
              </tr>
            </thead>
            <tbody>
              {d.reco.risks.map((r, i) => (
                <tr className="border-b border-slate-100 last:border-0" key={i}>
                  <td className="py-2 px-2.5 text-sm text-slate-800 font-medium align-top leading-relaxed">{r.risk}</td>
                  <td className="py-2 px-2.5 text-sm text-slate-500 align-top leading-relaxed">{r.type}</td>
                  <td className={`py-2 px-2.5 text-sm align-top leading-relaxed ${RISK_CLS[probClass(r.prob)] || 'text-slate-500'}`}>{r.prob}</td>
                  <td className={`py-2 px-2.5 text-sm align-top leading-relaxed ${RISK_CLS[impactClass(r.impact)] || 'text-slate-500'}`}>{r.impact}</td>
                  <td className="py-2 px-2.5 text-sm text-slate-500 align-top leading-relaxed">{r.horizon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.reco && d.reco.capexNote && (
        <div className="mt-3.5 p-3 bg-slate-50 border-l-2 border-emerald-300 rounded-r-lg">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-1.5">Nota de CapEx</div>
          <div className="text-sm text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: d.reco.capexNote }} />
        </div>
      )}

      {d.reco && (d.reco.text || d.reco.verdict) && (
        <div className="mt-4 p-3.5 bg-emerald-50/40 border border-emerald-200 rounded-lg">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-2">Recomendación de inversión</div>
          {d.reco.text && (
            <div className="text-sm text-slate-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: d.reco.text }} />
          )}
          {d.reco.verdict && (
            <div className="mt-2.5 py-2 px-3 bg-emerald-50 border-l-2 border-emerald-600 text-sm font-bold text-emerald-700">
              {d.reco.verdict}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
