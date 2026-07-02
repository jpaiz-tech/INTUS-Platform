import { useState, Fragment } from 'react';
import { scoreColor, tier, IRO_MAP } from '../utils.js';
import ExpandPanel from './ExpandPanel.jsx';

const DIM_HEADERS = [
  { label: 'DURABILIDAD', pct: '27%' },
  { label: 'SOLIDEZ',     pct: '22%' },
  { label: 'ADHESIÓN',    pct: '18%' },
  { label: 'SOLVENCIA',   pct: '16%' },
  { label: 'RESILIENCIA', pct: '17%' },
];

const TIER_CLS = {
  'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  A:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  B:    'bg-amber-50 text-amber-700 border-amber-200',
  C:    'bg-orange-50 text-orange-700 border-orange-200',
  D:    'bg-red-50 text-red-600 border-red-200',
};

function TierBadge({ score }) {
  const t = tier(score);
  return (
    <span className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 border rounded ${TIER_CLS[t] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {t}
    </span>
  );
}

function SpaRow({ d, expanded }) {
  return (
    <tr className={expanded ? 'bg-emerald-50/40' : ''}>
      <td colSpan={9} className="p-0 bg-slate-50">
        <div className="flex items-center gap-2 py-1.5 px-3 pl-5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap mr-1">Score por formato</span>
          {d.dimScores
            ? d.dimScores.map((rt, idx) => {
                const chip = d.assetChips
                  ? d.assetChips.find(ac => ac.label.toLowerCase().includes(rt.label.toLowerCase()))
                  : null;
                const s2  = chip ? chip.score : d.score;
                const c2  = scoreColor(s2);
                const matchingTab = d.tabs
                  ? d.tabs.find(tb => tb.shortLabel.toLowerCase() === rt.label.toLowerCase())
                  : null;
                const tabAssetLabel = matchingTab?.assets?.[0]?.label ?? '';
                const iroL = rt.label.toLowerCase() === 'promedio'
                  ? '' : (IRO_MAP[tabAssetLabel] || IRO_MAP[rt.label] || '');
                return (
                  <div key={idx} className="inline-flex items-center gap-1.5 border border-slate-200 px-2.5 py-0.5 rounded bg-white">
                    {iroL && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] font-bold">{iroL}</span>
                    )}
                    <span className="text-xs text-slate-400 tracking-wide">{rt.label.toUpperCase()}</span>
                    <span className="font-mono font-bold text-sm" style={{ color: c2 }}>{s2}</span>
                    <TierBadge score={s2} />
                  </div>
                );
              })
            : (
              <div className="inline-flex items-center gap-1.5 border border-slate-200 px-2.5 py-0.5 rounded bg-white">
                <span className="text-xs text-slate-400 tracking-wide">{d.assets?.[0]?.toUpperCase() ?? ''}</span>
                <span className="font-mono font-bold text-sm" style={{ color: scoreColor(d.score) }}>{d.score}</span>
                <TierBadge score={d.score} />
              </div>
            )
          }
        </div>
      </td>
    </tr>
  );
}

export default function ScoringTable({ sectors, editMode, onDeleteSector, onDeleteTab }) {
  const [expandedIdx,  setExpandedIdx]  = useState(null);
  const [confirmIdx,   setConfirmIdx]   = useState(null);
  const [deletingName, setDeletingName] = useState(null);
  const [deleteError,  setDeleteError]  = useState(null);

  function toggle(i, d) {
    if (editMode) return;
    if (!d.hasDetail) return;
    setExpandedIdx(prev => prev === i ? null : i);
  }

  async function confirmDelete(name) {
    setDeletingName(name);
    setDeleteError(null);
    try {
      await onDeleteSector(name);
      setConfirmIdx(null);
      setExpandedIdx(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <>
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Matriz de scoring — haga clic en una fila para ver el detalle</div>
      <div className="text-xs text-slate-400 italic text-center pb-2.5">
        Sub-criterios cargados para todos los sectores detallados · cadena de cálculo determinística: sub-criterios → dimensión (promedio ×10) → score por formato (ponderado) → compuesto (promedio entre formatos, ponderado)
      </div>
      {deleteError && (
        <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {deleteError}
        </div>
      )}
      <div className="overflow-x-auto mb-10">
        <table className="w-full text-sm border-collapse min-w-[960px]">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="text-left py-2.5 px-3 text-xs font-bold text-slate-400 uppercase whitespace-nowrap" style={{ width: 200 }}>Industria / Sector</th>
              {DIM_HEADERS.map(h => (
                <th key={h.label} className="text-center py-2.5 px-2 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">
                  {h.label}<br /><span className="opacity-50 font-normal normal-case text-[11px]">{h.pct}</span>
                </th>
              ))}
              <th className="text-center py-2.5 px-2 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">SCORE</th>
              <th className="text-center py-2.5 px-2 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">TIER</th>
              <th className="text-center py-2.5 px-2 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">ACTIVO</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((d, i) => {
              const sc         = scoreColor(d.score);
              const isExpanded = expandedIdx === i;
              const isConfirm  = confirmIdx  === i;
              const isDeleting = deletingName === d.name;
              const primary    = d.dimScores?.[0];

              return (
                <Fragment key={`sector-${i}`}>
                  <tr
                    className={`border-b border-slate-100 transition-colors ${editMode ? '' : 'cursor-pointer hover:bg-emerald-50/30'} ${isExpanded ? 'bg-emerald-50/40' : ''}`}
                    onClick={() => toggle(i, d)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <span className="flex-1 text-sm font-bold text-slate-800">
                          {d.name}
                          {!editMode && d.hasDetail && (
                            <span className="text-xs text-emerald-500 ml-1.5 opacity-70">▸</span>
                          )}
                        </span>
                        {editMode && (
                          <button
                            className="text-slate-300 hover:text-red-500 text-sm font-bold px-1.5"
                            title={`Eliminar ${d.name}`}
                            onClick={e => { e.stopPropagation(); setConfirmIdx(i); setDeleteError(null); }}
                          >×</button>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{d.sub}</div>
                      {isConfirm && (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex-wrap" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-slate-600 flex-1">¿Eliminar <strong>{d.name}</strong>? Esta acción no se puede deshacer.</span>
                          <button
                            className="bg-red-500 text-white rounded-lg text-xs font-semibold px-3 py-1.5 hover:bg-red-600 transition-all disabled:opacity-50"
                            onClick={() => confirmDelete(d.name)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? 'Eliminando…' : 'Eliminar'}
                          </button>
                          <button
                            className="border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-3 py-1.5 hover:border-emerald-300 hover:text-emerald-600 transition-all disabled:opacity-50"
                            onClick={() => setConfirmIdx(null)}
                            disabled={isDeleting}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>

                    {DIM_HEADERS.map((_, dimIdx) => {
                      if (!primary) {
                        return <td key={dimIdx} className="text-center py-2.5 px-2"><span className="text-xl font-mono text-slate-200 tracking-wide">—</span></td>;
                      }
                      const s   = primary.scores[dimIdx] ?? 0;
                      const c   = scoreColor(s);
                      const avg = (s / 10).toFixed(1);
                      return (
                        <td key={dimIdx} className="text-center py-2.5 px-2">
                          <div className="font-mono font-bold text-2xl leading-none mb-1" style={{ color: c }}>{s}</div>
                          <div className="text-xs text-slate-400">avg {avg}/10</div>
                        </td>
                      );
                    })}

                    <td className="text-center py-2.5 px-2">
                      <div
                        className="inline-flex flex-col items-center justify-center w-[52px] h-[52px] border-[1.5px] rounded-lg"
                        style={{ borderColor: `${sc}60`, background: `${sc}08` }}
                      >
                        <div className="font-mono font-bold text-xl leading-none" style={{ color: sc }}>{d.score}</div>
                        <div className="text-[11px] opacity-50 mt-0.5">/ 100</div>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      <TierBadge score={d.score} />
                    </td>
                    <td className="py-2.5 px-2">
                      {(d.assets || []).map(a => (
                        <span key={a} className="inline-block px-1.5 py-0.5 border border-slate-200 rounded text-xs font-bold text-slate-500 mx-0.5 my-0.5">{a}</span>
                      ))}
                    </td>
                  </tr>

                  <SpaRow d={d} expanded={isExpanded} />

                  {isExpanded && d.hasDetail && (
                    <tr>
                      <td colSpan={9} className="p-0 border-b-2 border-emerald-200">
                        <ExpandPanel d={d} editMode={editMode} onDeleteTab={onDeleteTab} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
