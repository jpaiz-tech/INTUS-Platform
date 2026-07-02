import { useState } from 'react';
import { scoreColor, tier, tierClass, subCls, IRO_MAP, probClass, impactClass } from '../utils.js';

function DimCard({ dim, isFirst }) {
  const sc = dim.color || scoreColor(dim.score);
  return (
    <div className={`dim-card${isFirst ? ' hi' : ''}`}>
      <div className="dim-card-head">
        <div className="dim-card-label">{dim.label}</div>
        <div className="dim-card-score" style={{ color: sc }}>{dim.score}</div>
      </div>
      <div className="dim-bar-wrap">
        <div className="dim-bar-fill" style={{ width: `${dim.score}%`, background: sc }} />
      </div>
      <div className="sub-list">
        {(dim.subs || []).map((sub, i) => {
          const crit = sub.spaceCriticality;
          return (
            <div className="sub-item" key={i}>
              {!crit && (
                <div className={`sub-pill ${subCls(sub.s)}`}>{sub.s}/10</div>
              )}
              <div className={crit ? 'sub-content-full' : ''}>
                <div className="sub-cname">{sub.n}</div>
                {crit && (
                  <div className={`space-crit-badge sc-${crit.level}`}>
                    {crit.label}
                  </div>
                )}
                <div className="sub-cnote">
                  {sub.tag && <span className="tag-badge">[{sub.tag}]</span>}
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
    <div className="expand-inner">
      {tabs.length > 0 && (
        <div className="tab-bar">
          {tabs.map((t, ti) => {
            const sc = scoreColor(t.score);
            const tc = tierClass(t.score);
            const assetLabel = t.assets && t.assets[0] ? t.assets[0].label : '';
            const iroLetter  = IRO_MAP[assetLabel] || IRO_MAP[t.shortLabel] || '';
            const isConfirm  = confirmTabIdx === ti;
            const isDeleting = deletingTab === t.shortLabel;
            return (
              <div key={ti} className="tab-btn-wrap">
                <button
                  className={`tab-btn${ti === activeTab ? ' active' : ''}`}
                  onClick={() => { if (!editMode) setActiveTab(ti); }}
                >
                  {t.shortLabel}
                  {iroLetter && <span className="iro-badge">{iroLetter}</span>}
                  <span className="tab-score-badge" style={{ color: sc, borderColor: `${sc}50` }}>{t.score}</span>
                  {editMode && (
                    <span
                      className="delete-tab-btn"
                      title={`Eliminar formato ${t.shortLabel}`}
                      onClick={e => { e.stopPropagation(); setConfirmTabIdx(ti); setTabDeleteErr(null); }}
                    >×</span>
                  )}
                </button>
                {isConfirm && (
                  <div className="confirm-inline tab-confirm" onClick={e => e.stopPropagation()}>
                    <span className="confirm-msg">
                      ¿Eliminar el formato <strong>{t.shortLabel}</strong> de <strong>{d.name}</strong>?
                    </span>
                    <button
                      className="confirm-yes"
                      onClick={() => confirmDeleteTab(t.shortLabel)}
                      disabled={isDeleting}
                    >{isDeleting ? 'Eliminando…' : 'Eliminar'}</button>
                    <button
                      className="confirm-no"
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
        <div style={{ margin: '4px 0 8px', padding: '6px 10px', background: 'rgba(142,58,58,.08)', border: '1px solid rgba(142,58,58,.3)', borderRadius: 2, fontFamily: 'Verdana,sans-serif', fontSize: 13, color: '#8E3A3A' }}>
          {tabDeleteErr}
        </div>
      )}

      {tab && (
        <div className="dim-grid">
          {(tab.dims || []).map((dim, di) => (
            <DimCard key={di} dim={dim} isFirst={di === 0} />
          ))}
        </div>
      )}

      {d.assetChips && d.assetChips.length > 0 && (
        <div className="asset-chips-row">
          <span className="asset-chips-label">Score ajustado por activo</span>
          {d.assetChips.map((c, i) => {
            const sc = c.pending ? 'var(--w60)' : scoreColor(c.score);
            const tc = c.pending ? '' : tierClass(c.score);
            return (
              <div className="asset-chip-full" key={i}>
                <span className="afc-label">{c.label}</span>
                <span className="afc-score" style={{ color: sc }}>{c.pending ? '—' : c.score}</span>
                {c.pending
                  ? <span style={{ fontSize: 13, opacity: .5, fontStyle: 'italic' }}>pendiente</span>
                  : <span className={`rank-tier ${tc}`} style={{ fontSize: 12, padding: '1px 5px', color: sc, borderColor: `${sc}50` }}>{tier(c.score)}</span>
                }
              </div>
            );
          })}
        </div>
      )}

      {d.reco && d.reco.risks && d.reco.risks.length > 0 && (
        <div className="risk-section">
          <div className="risk-label">Tabla de riesgos</div>
          <table className="risk-table">
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Riesgo</th>
                <th>Tipo</th>
                <th>Probabilidad</th>
                <th>Impacto</th>
                <th>Horizonte de disrupción</th>
              </tr>
            </thead>
            <tbody>
              {d.reco.risks.map((r, i) => (
                <tr key={i}>
                  <td>{r.risk}</td>
                  <td>{r.type}</td>
                  <td className={probClass(r.prob)}>{r.prob}</td>
                  <td className={impactClass(r.impact)}>{r.impact}</td>
                  <td>{r.horizon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.reco && d.reco.capexNote && (
        <div className="capex-note-section">
          <div className="capex-note-label">Nota de CapEx</div>
          <div className="capex-note-text" dangerouslySetInnerHTML={{ __html: d.reco.capexNote }} />
        </div>
      )}

      {d.reco && (d.reco.text || d.reco.verdict) && (
        <div className="reco-box">
          <div className="reco-label">Recomendación de inversión</div>
          {d.reco.text && (
            <div className="reco-text" dangerouslySetInnerHTML={{ __html: d.reco.text }} />
          )}
          {d.reco.verdict && (
            <div className="reco-verdict">{d.reco.verdict}</div>
          )}
        </div>
      )}
    </div>
  );
}
