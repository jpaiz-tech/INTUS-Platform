import { useState, useEffect, useCallback } from 'react';
import MiniChart from './MiniChart.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

const COUNTRIES = ['Panamá', 'Costa Rica', 'El Salvador', 'Guatemala', 'Rep. Dominicana'];
const SECTORS   = ['Oficinas', 'Industrial', 'Retail'];

function fmt(val) {
  if (val == null) return '—';
  return typeof val === 'number'
    ? val.toLocaleString('es-PA', { maximumFractionDigits: 1 })
    : val;
}

function fmtPct(val) {
  if (val == null) return '—';
  const pct = val < 1 ? val * 100 : val;
  return pct.toLocaleString('es-PA', { maximumFractionDigits: 1 }) + '%';
}

export default function QueryView() {
  const [filters, setFilters]       = useState({ pais: '', sector: '', periodo: '' });
  const [aggregated, setAggregated] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.pais)    params.set('pais',    filters.pais);
    if (filters.sector)  params.set('sector',  filters.sector);
    if (filters.periodo) params.set('periodo', filters.periodo);

    try {
      const res  = await fetch(`${BASE}/api/market-data/aggregate?${params}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setAggregated(data);
    } catch (err) {
      setError(err.message);
      setAggregated(null);
    } finally {
      setLoading(false);
    }
  }, [filters.pais, filters.sector, filters.periodo]);

  useEffect(() => { fetchData(); }, [filters.pais, filters.sector]);

  const trend = aggregated?.trend || [];

  // Label for the print header
  const printTitle = [filters.pais || 'Todos los países', filters.sector || 'Todos los sectores']
    .filter(Boolean).join(' · ');
  const printPeriod = filters.periodo || aggregated?.latest_periodo || '';

  return (
    <div className="mi-query-view">

      {/* ── Filter bar (hidden on print) ── */}
      <div className="mi-query-filters no-print">
        <div className="mi-filter-group">
          <label className="mi-filter-label">País</label>
          <select
            className="mi-filter-select"
            value={filters.pais}
            onChange={e => setFilters(f => ({ ...f, pais: e.target.value }))}
          >
            <option value="">Todos los países</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="mi-filter-group">
          <label className="mi-filter-label">Sector</label>
          <select
            className="mi-filter-select"
            value={filters.sector}
            onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
          >
            <option value="">Todos los sectores</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mi-filter-group">
          <label className="mi-filter-label">Período</label>
          <select
            className="mi-filter-select"
            value={filters.periodo}
            onChange={e => setFilters(f => ({ ...f, periodo: e.target.value }))}
          >
            <option value="">Período más reciente</option>
            {(aggregated?.available_periodos || []).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <button className="mi-search-btn" onClick={fetchData} disabled={loading}>
          {loading ? <span className="mi-spinner" /> : 'Buscar'}
        </button>

        {aggregated && (
          <button className="mi-print-btn no-print" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        )}
      </div>

      {error && <div className="mi-chat-error no-print">{error}</div>}

      {loading && (
        <div className="mi-query-results mi-loading-state no-print">
          <span className="mi-spinner" />
          <span>Cargando datos…</span>
        </div>
      )}

      {!loading && aggregated && (
        <div className="mi-query-results">

          {/* Print-only header */}
          <div className="mi-print-header print-only">
            <div className="mi-print-logo">ETRA</div>
            <div className="mi-print-title">{printTitle}</div>
            {printPeriod && <div className="mi-print-period">{printPeriod}</div>}
          </div>

          {/* Coverage bar */}
          <div className="mi-coverage-bar no-print">
            <span>{aggregated.subzona_count ?? aggregated.by_subzona?.length ?? 0} subzonas</span>
            <span className="mi-coverage-sep">·</span>
            <span>{aggregated.source_count ?? 0} fuentes</span>
            <span className="mi-coverage-sep">·</span>
            <span>Período más reciente: <strong>{aggregated.latest_periodo || '—'}</strong></span>
          </div>

          {/* Metric cards */}
          {aggregated.metric_cards?.length > 0 && (
            <div className="mi-cards-grid">
              {aggregated.metric_cards.map((card, i) => (
                <div key={i} className={`mi-card${card.missing ? ' mi-card-missing' : ''}${card.hasRange ? ' mi-card-range' : ''}`}>
                  <div className="mi-card-label">{card.label}</div>
                  <div className="mi-card-value">
                    {card.missing ? 'sin datos' : card.value}
                  </div>
                  {!card.missing && (
                    <>
                      <div className="mi-card-unit">
                        {card.unit}
                        {card.hasRange && <span className="mi-card-range-tag"> rango</span>}
                      </div>
                      <div className="mi-card-period">{card.period || aggregated.latest_periodo}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Subzone table — each subzone at its own most recent period, sorted by renta */}
          {(() => {
            const subzonas = (aggregated.by_subzona || [])
              .sort((a, b) => (b.renta_prom_m2_mes ?? -Infinity) - (a.renta_prom_m2_mes ?? -Infinity));
            return subzonas.length > 0 && (
              <div className="mi-table-wrap">
                <table className="mi-data-table">
                  <thead>
                    <tr>
                      <th>Subzona</th>
                      <th>Período</th>
                      <th>Renta (USD/m²/mes)</th>
                      <th>Disponibilidad</th>
                      <th>Inventario (m²)</th>
                      <th>Absorción Neta (m²)</th>
                      <th>Cap Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subzonas.map((row, i) => (
                      <tr key={i}>
                        <td>
                          {row.subzona || row.ciudad || '—'}
                          {row._rowCount > 1 && <span className="mi-row-multi"> ×{row._rowCount}</span>}
                        </td>
                        <td>{row.periodo || '—'}</td>
                        <td>
                          {row.renta_prom_m2_mes_min != null
                            ? <span className="mi-range-val">{fmt(row.renta_prom_m2_mes_min)}–{fmt(row.renta_prom_m2_mes_max)}</span>
                            : fmt(row.renta_prom_m2_mes)}
                        </td>
                        <td>
                          {row.disponibilidad_min != null
                            ? <span className="mi-range-val">{fmtPct(row.disponibilidad_min)}–{fmtPct(row.disponibilidad_max)}</span>
                            : fmtPct(row.disponibilidad)}
                        </td>
                        <td>{row.inventario_total_m2 != null ? row.inventario_total_m2.toLocaleString('es-PA') : '—'}</td>
                        <td>{row.absorc_neta_trim_m2 != null ? row.absorc_neta_trim_m2.toLocaleString('es-PA') : '—'}</td>
                        <td>
                          {row.cap_rate_min != null
                            ? <span className="mi-range-val">{fmtPct(row.cap_rate_min)}–{fmtPct(row.cap_rate_max)}</span>
                            : fmtPct(row.cap_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Por Clase breakdown */}
          {aggregated.by_tipo?.length > 0 && (
            <div className="mi-table-wrap">
              <div className="mi-section-label">Por Clase</div>
              <table className="mi-data-table">
                <thead>
                  <tr>
                    <th>Clase</th>
                    <th>Renta (USD/m²/mes)</th>
                    <th>Inventario Total (m²)</th>
                    <th>Disponibilidad Prom.</th>
                    <th>Subzonas</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.by_tipo.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{row.tipo}</td>
                      <td>
                        {row.renta_max != null
                          ? <span className="mi-range-val">{fmt(row.renta_min)}–{fmt(row.renta_max)}</span>
                          : fmt(row.renta_min)}
                      </td>
                      <td>{row.inventario_total_m2 != null ? Math.round(row.inventario_total_m2).toLocaleString('es-PA') : '—'}</td>
                      <td>{row.disponibilidad_avg != null ? fmtPct(row.disponibilidad_avg) : '—'}</td>
                      <td>{row.subzona_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Trend charts */}
          {trend.length >= 2 && (
            <>
              <MiniChart
                type="line"
                title="Evolución — Renta Promedio"
                labels={trend.map(r => r.periodo)}
                datasets={[{
                  label:  'Renta (USD/m²/mes)',
                  values: trend.map(r => r.renta_prom_m2_mes),
                  color:  '#A88B4F',
                }]}
              />
              {trend.some(r => r.disponibilidad != null) && (
                <MiniChart
                  type="line"
                  title="Evolución — Disponibilidad"
                  labels={trend.map(r => r.periodo)}
                  datasets={[{
                    label:  'Disponibilidad (%)',
                    values: trend.map(r =>
                      r.disponibilidad != null
                        ? +(r.disponibilidad < 1 ? r.disponibilidad * 100 : r.disponibilidad).toFixed(1)
                        : null
                    ),
                    color:  '#4A7FA5',
                  }]}
                />
              )}
            </>
          )}

          {/* Print footer */}
          <div className="mi-print-footer print-only">
            Fuente: Base de datos ETRA · {new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

        </div>
      )}
    </div>
  );
}
