import { useState, Fragment } from 'react';
import { scoreColor, tier, tierClass, IRO_MAP } from '../utils.js';
import ExpandPanel from './ExpandPanel.jsx';

const DIM_HEADERS = [
  { label: 'DURABILIDAD', pct: '27%' },
  { label: 'SOLIDEZ',     pct: '22%' },
  { label: 'ADHESIÓN',    pct: '18%' },
  { label: 'SOLVENCIA',   pct: '16%' },
  { label: 'RESILIENCIA', pct: '17%' },
];

function SpaRow({ d, expanded }) {
  const sc = scoreColor(d.score);
  const tc = tierClass(d.score);
  const t  = tier(d.score);

  return (
    <tr className={`spa-row${expanded ? ' is-expanded' : ''}`}>
      <td colSpan={9} style={{ padding: 0, background: 'var(--w08)' }}>
        <div className="spa-inner">
          <span className="spa-label">Score por formato</span>
          {d.dimScores
            ? d.dimScores.map((rt, idx) => {
                const chip = d.assetChips
                  ? d.assetChips.find(ac => ac.label.toLowerCase().includes(rt.label.toLowerCase()))
                  : null;
                const s2  = chip ? chip.score : d.score;
                const c2  = scoreColor(s2);
                const tc2 = tierClass(s2);
                const matchingTab = d.tabs
                  ? d.tabs.find(tb => tb.shortLabel.toLowerCase() === rt.label.toLowerCase())
                  : null;
                const tabAssetLabel = matchingTab?.assets?.[0]?.label ?? '';
                const iroL = rt.label.toLowerCase() === 'promedio'
                  ? '' : (IRO_MAP[tabAssetLabel] || IRO_MAP[rt.label] || '');
                return (
                  <div key={idx} className="spa-chip">
                    {iroL && <span className="iro-badge" style={{ marginLeft: 0, marginRight: 2, opacity: 0.7 }}>{iroL}</span>}
                    <span className="spa-chip-label">{rt.label.toUpperCase()}</span>
                    <span className="spa-chip-score" style={{ color: c2 }}>{s2}</span>
                    <span className={`rank-tier ${tc2}`} style={{ fontSize: 12, padding: '1px 5px', color: c2, borderColor: `${c2}50` }}>{tier(s2)}</span>
                  </div>
                );
              })
            : (
              <div className="spa-chip">
                <span className="spa-chip-label">{d.assets?.[0]?.toUpperCase() ?? ''}</span>
                <span className="spa-chip-score" style={{ color: sc }}>{d.score}</span>
                <span className={`rank-tier ${tc}`} style={{ fontSize: 12, padding: '1px 5px' }}>{t}</span>
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
      <div className="slabel">Matriz de scoring — haga clic en una fila para ver el detalle</div>
      <div className="pending-note">
        Sub-criterios cargados para todos los sectores detallados · cadena de cálculo determinística: sub-criterios → dimensión (promedio ×10) → score por formato (ponderado) → compuesto (promedio entre formatos, ponderado)
      </div>
      {deleteError && (
        <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(142,58,58,.08)', border: '1px solid rgba(142,58,58,.3)', borderRadius: 2, fontFamily: 'Verdana,sans-serif', fontSize: 13, color: '#8E3A3A' }}>
          {deleteError}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left" style={{ width: 200 }}>Industria / Sector</th>
              {DIM_HEADERS.map(h => (
                <th key={h.label}>{h.label}<br /><span style={{ opacity: .5, fontSize: 11 }}>{h.pct}</span></th>
              ))}
              <th>SCORE</th>
              <th>TIER</th>
              <th>ACTIVO</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((d, i) => {
              const sc         = scoreColor(d.score);
              const tc         = tierClass(d.score);
              const t          = tier(d.score);
              const isExpanded = expandedIdx === i;
              const isConfirm  = confirmIdx  === i;
              const isDeleting = deletingName === d.name;
              const primary    = d.dimScores?.[0];

              return (
                <Fragment key={`sector-${i}`}>
                  <tr
                    className={`sector-row${isExpanded ? ' is-expanded' : ''}${isConfirm ? ' confirm-pending' : ''}`}
                    onClick={() => toggle(i, d)}
                  >
                    <td>
                      <div className="ind-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ flex: 1 }}>
                          {d.name}
                          {!editMode && d.hasDetail && (
                            <span style={{ fontSize: 13, color: 'var(--green)', marginLeft: 6, opacity: .7 }}>▸</span>
                          )}
                        </span>
                        {editMode && (
                          <button
                            className="delete-row-btn"
                            title={`Eliminar ${d.name}`}
                            onClick={e => { e.stopPropagation(); setConfirmIdx(i); setDeleteError(null); }}
                          >×</button>
                        )}
                      </div>
                      <div className="ind-sub">{d.sub}</div>
                      {isConfirm && (
                        <div className="confirm-inline" onClick={e => e.stopPropagation()}>
                          <span className="confirm-msg">¿Eliminar <strong>{d.name}</strong>? Esta acción no se puede deshacer.</span>
                          <button className="confirm-yes" onClick={() => confirmDelete(d.name)} disabled={isDeleting}>
                            {isDeleting ? 'Eliminando…' : 'Eliminar'}
                          </button>
                          <button className="confirm-no" onClick={() => setConfirmIdx(null)} disabled={isDeleting}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </td>

                    {DIM_HEADERS.map((_, dimIdx) => {
                      if (!primary) {
                        return <td key={dimIdx} className="dim-cell"><span className="dim-pending">—</span></td>;
                      }
                      const s   = primary.scores[dimIdx] ?? 0;
                      const c   = scoreColor(s);
                      const avg = (s / 10).toFixed(1);
                      return (
                        <td key={dimIdx} className="dim-cell">
                          <div className="dim-score-main" style={{ color: c }}>{s}</div>
                          <div className="dim-avg-label">avg {avg}/10</div>
                        </td>
                      );
                    })}

                    <td className="final-cell">
                      <div className="final-box" style={{ borderColor: `${sc}60`, background: `${sc}08` }}>
                        <div className="final-num" style={{ color: sc }}>{d.score}</div>
                        <div className="final-sub">/ 100</div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`rank-tier ${tc}`}>{t}</span>
                    </td>
                    <td>
                      {(d.assets || []).map(a => (
                        <span key={a} className="atag">{a}</span>
                      ))}
                    </td>
                  </tr>

                  <SpaRow d={d} expanded={isExpanded} />

                  {isExpanded && d.hasDetail && (
                    <tr className="expand-row">
                      <td colSpan={9} className="expand-td">
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
