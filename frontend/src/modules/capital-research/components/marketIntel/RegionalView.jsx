import { useState, useEffect } from 'react';
import MiniChart from './MiniChart.jsx';

const BASE    = import.meta.env.VITE_API_BASE || '';
const SECTORS = ['Oficinas', 'Industrial', 'Retail'];

function fmt(val) {
  if (val == null) return '—';
  return Number(val).toLocaleString('es-PA', { maximumFractionDigits: 2 });
}

function fmtPct(val) {
  if (val == null) return '—';
  const pct = val < 1 ? val * 100 : val;
  return pct.toLocaleString('es-PA', { maximumFractionDigits: 1 }) + '%';
}

function shortLabel(pais) {
  return pais
    .replace('Rep. Dominicana', 'Rep.Dom.')
    .replace('El Salvador', 'El Salv.')
    .replace('Costa Rica', 'C.Rica');
}

export default function RegionalView() {
  const [sector,  setSector]  = useState('Oficinas');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${BASE}/api/market-data/regional?sector=${encodeURIComponent(sector)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [sector]);

  const countries = data?.countries || [];
  const withRenta = countries.filter(c => c.renta_prom_m2_mes != null);
  const withDisp  = countries.filter(c => c.disponibilidad  != null);
  const chartLabels = countries.map(c => shortLabel(c.pais));

  return (
    <div className="mi-regional-view">

      {/* Sector toggle */}
      <div className="mi-regional-filters no-print">
        {SECTORS.map(s => (
          <button
            key={s}
            className={`mi-regional-sector-btn${sector === s ? ' active' : ''}`}
            onClick={() => setSector(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="mi-chat-error">{error}</div>}

      {loading && (
        <div className="mi-regional-loading">
          <span className="mi-spinner" />
          <span>Cargando comparativo regional…</span>
        </div>
      )}

      {!loading && countries.length === 0 && !error && (
        <div className="mi-regional-empty">
          No hay datos de {sector} cargados en la base de datos.
        </div>
      )}

      {!loading && countries.length > 0 && (
        <div className="mi-regional-results">

          {/* Summary table */}
          <div className="mi-table-wrap">
            <table className="mi-data-table">
              <thead>
                <tr>
                  <th>País</th>
                  <th>Período</th>
                  <th>Renta (USD/m²/mes)</th>
                  <th>Disponibilidad</th>
                  <th>Inventario (m²)</th>
                  <th>Absorción Neta (m²)</th>
                  <th>Cap Rate</th>
                  <th>Subzonas</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.pais}</td>
                    <td>{c.latest_periodo || '—'}</td>
                    <td>
                      {c.renta_prom_m2_mes_max != null
                        ? <span className="mi-range-val">{fmt(c.renta_prom_m2_mes)}–{fmt(c.renta_prom_m2_mes_max)}</span>
                        : fmt(c.renta_prom_m2_mes)}
                    </td>
                    <td>
                      {c.disponibilidad_max != null
                        ? <span className="mi-range-val">{fmtPct(c.disponibilidad)}–{fmtPct(c.disponibilidad_max)}</span>
                        : fmtPct(c.disponibilidad)}
                    </td>
                    <td>{c.inventario_total_m2 != null ? c.inventario_total_m2.toLocaleString('es-PA') : '—'}</td>
                    <td>
                      {c.absorc_neta_trim_m2 != null
                        ? (c.absorc_neta_trim_m2 >= 0 ? '+' : '') + c.absorc_neta_trim_m2.toLocaleString('es-PA')
                        : '—'}
                    </td>
                    <td>
                      {c.cap_rate_max != null
                        ? <span className="mi-range-val">{fmtPct(c.cap_rate)}–{fmtPct(c.cap_rate_max)}</span>
                        : fmtPct(c.cap_rate)}
                    </td>
                    <td>{c.subzona_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comparison bar charts */}
          {withRenta.length >= 2 && (
            <div className="mi-regional-charts">
              <MiniChart
                type="bar"
                title={`Renta Promedio — ${sector}`}
                labels={chartLabels}
                datasets={[{
                  label:  'Renta (USD/m²/mes)',
                  values: countries.map(c => c.renta_prom_m2_mes),
                  color:  '#A88B4F',
                }]}
              />
              {withDisp.length >= 2 && (
                <MiniChart
                  type="bar"
                  title={`Disponibilidad — ${sector}`}
                  labels={chartLabels}
                  datasets={[{
                    label:  'Disponibilidad (%)',
                    values: countries.map(c =>
                      c.disponibilidad != null
                        ? +(c.disponibilidad < 1 ? c.disponibilidad * 100 : c.disponibilidad).toFixed(1)
                        : null
                    ),
                    color:  '#4A7FA5',
                  }]}
                />
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
