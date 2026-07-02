import { useEffect, useState } from 'react';
import ReportView from './ReportView.jsx';
import { scoreColor, tier, tierClass } from '../utils.js';

const BASE = import.meta.env.VITE_API_BASE || '';

export default function HistorialPanel() {
  const [runs,       setRuns]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [expanded,   setExpanded]   = useState(null);  // run id currently expanded
  const [detail,     setDetail]     = useState({});    // id → full run object
  const [detailLoad, setDetailLoad] = useState({});    // id → bool

  useEffect(() => {
    fetch(`${BASE}/api/runs`)
      .then(r => r.json())
      .then(data => {
        // Only show completed agent3 runs that have a sector object
        const filtered = data.filter(r =>
          r.agent === 'agent3' &&
          (r.status === 'completed' || r.status === 'truncated') &&
          (r.sectorName || r.finalScore != null)
        );
        setRuns(filtered);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  async function toggle(run) {
    if (expanded === run.id) {
      setExpanded(null);
      return;
    }
    setExpanded(run.id);
    if (detail[run.id]) return; // already loaded

    // Sector-fallback entries have no UUID — ReportView only needs sectorName
    if (run.id.startsWith('sector-')) {
      setDetail(prev => ({ ...prev, [run.id]: { sectorObject: { name: run.sectorName } } }));
      return;
    }

    setDetailLoad(prev => ({ ...prev, [run.id]: true }));
    try {
      const res  = await fetch(`${BASE}/api/runs/${run.id}`);
      const data = await res.json();
      setDetail(prev => ({ ...prev, [run.id]: data }));
    } catch {
      setDetail(prev => ({ ...prev, [run.id]: null }));
    } finally {
      setDetailLoad(prev => ({ ...prev, [run.id]: false }));
    }
  }

  return (
    <div className="hist-wrap">
      <div className="hist-header">
        <div className="hist-title">Historial de reportes</div>
        <div className="hist-sub">Reportes generados en este entorno — ordenados por fecha</div>
      </div>

      {loading && <div className="hist-loading">Cargando historial…</div>}
      {error   && <div className="hist-err">Error: {error}</div>}

      {!loading && !error && runs.length === 0 && (
        <div className="hist-empty">
          Aún no hay reportes generados. Usa la pestaña <strong>Investigación</strong> para crear el primero.
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="hist-list">
          {runs.map(run => {
            const sc  = run.finalScore != null ? scoreColor(run.finalScore) : '#888';
            const tc  = run.finalScore != null ? tierClass(run.finalScore) : '';
            const t   = run.finalScore != null ? tier(run.finalScore) : '—';
            const isOpen = expanded === run.id;
            const fullRun = detail[run.id];
            const loading = detailLoad[run.id];

            return (
              <div key={run.id} className={`hist-entry${isOpen ? ' open' : ''}`}>
                <div className="hist-entry-head" onClick={() => toggle(run)}>
                  <div className="hist-entry-left">
                    <div className="hist-sector-name">{run.sectorName || run.industry || '—'}</div>
                    <div className="hist-sector-meta">
                      {run.realEstateType && <span className="hist-tag">{run.realEstateType}</span>}
                      {run.company        && <span className="hist-tag">{run.company}</span>}
                    </div>
                  </div>
                  <div className="hist-entry-right">
                    {run.finalScore != null && (
                      <>
                        <span className="hist-score" style={{ color: sc }}>{run.finalScore}</span>
                        <span className={`rank-tier ${tc}`} style={{ fontSize: 12 }}>{t}</span>
                      </>
                    )}
                    <div className="hist-date">
                      {new Date(run.createdAt).toLocaleDateString('es-PA', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </div>
                    <span className="hist-chevron">{isOpen ? '▾' : '▸'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="hist-entry-body">
                    {loading && (
                      <div className="hist-loading-detail">Cargando reporte…</div>
                    )}
                    {!loading && fullRun === null && (
                      <div className="hist-err">No se pudo cargar el reporte.</div>
                    )}
                    {!loading && fullRun?.sectorObject && (
                      <ReportView sectorName={fullRun.sectorObject.name} />
                    )}
                    {!loading && fullRun && !fullRun.sectorObject && (
                      <div className="hist-err">Este reporte no tiene datos de sector guardados.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
