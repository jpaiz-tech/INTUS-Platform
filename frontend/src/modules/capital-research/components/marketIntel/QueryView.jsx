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
    <div className="flex flex-col gap-4">

      {/* ── Filter bar (hidden on print) ── */}
      <div className="no-print flex flex-wrap items-end gap-3 bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">País</label>
          <select
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none"
            value={filters.pais}
            onChange={e => setFilters(f => ({ ...f, pais: e.target.value }))}
          >
            <option value="">Todos los países</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sector</label>
          <select
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none"
            value={filters.sector}
            onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
          >
            <option value="">Todos los sectores</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Período</label>
          <select
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none"
            value={filters.periodo}
            onChange={e => setFilters(f => ({ ...f, periodo: e.target.value }))}
          >
            <option value="">Período más reciente</option>
            {(aggregated?.available_periodos || []).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <button className="bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 hover:bg-emerald-600 transition-all disabled:opacity-50" onClick={fetchData} disabled={loading}>
          {loading ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Buscar'}
        </button>

        {aggregated && (
          <button className="no-print border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-4 py-2 hover:border-emerald-300 hover:text-emerald-600 transition-all" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        )}
      </div>

      {error && <div className="no-print bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3">{error}</div>}

      {loading && (
        <div className="no-print flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <span className="inline-block w-4 h-4 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <span>Cargando datos…</span>
        </div>
      )}

      {!loading && aggregated && (
        <div className="flex flex-col gap-4">

          {/* Print-only header */}
          <div className="print-only">
            <div className="text-lg font-bold text-slate-800">ETRA</div>
            <div className="text-base font-semibold text-slate-700">{printTitle}</div>
            {printPeriod && <div className="text-xs text-slate-400">{printPeriod}</div>}
          </div>

          {/* Coverage bar */}
          <div className="no-print flex items-center gap-2 text-xs text-slate-500">
            <span>{aggregated.subzona_count ?? aggregated.by_subzona?.length ?? 0} subzonas</span>
            <span className="text-slate-300">·</span>
            <span>{aggregated.source_count ?? 0} fuentes</span>
            <span className="text-slate-300">·</span>
            <span>Período más reciente: <strong>{aggregated.latest_periodo || '—'}</strong></span>
          </div>

          {/* Metric cards */}
          {aggregated.metric_cards?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {aggregated.metric_cards.map((card, i) => (
                <div key={i} className={`bg-white rounded-xl border border-slate-200 p-4 ${card.missing ? 'opacity-50' : ''}`}>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">{card.label}</div>
                  <div className="text-xl font-bold text-slate-800 font-mono">
                    {card.missing ? 'sin datos' : card.value}
                  </div>
                  {!card.missing && (
                    <>
                      <div className="text-xs text-slate-400 mt-1">
                        {card.unit}
                        {card.hasRange && <span className="text-[10px] text-emerald-600 ml-1">rango</span>}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{card.period || aggregated.latest_periodo}</div>
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
              <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Subzona</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Período</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Renta (USD/m²/mes)</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Disponibilidad</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Inventario (m²)</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Absorción Neta (m²)</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Cap Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subzonas.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30">
                        <td className="py-2 px-3 text-slate-700">
                          {row.subzona || row.ciudad || '—'}
                          {row._rowCount > 1 && <span className="text-slate-400 text-xs ml-1">×{row._rowCount}</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-mono text-xs">{row.periodo || '—'}</td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">
                          {row.renta_prom_m2_mes_min != null
                            ? <span className="font-mono text-xs text-slate-600">{fmt(row.renta_prom_m2_mes_min)}–{fmt(row.renta_prom_m2_mes_max)}</span>
                            : fmt(row.renta_prom_m2_mes)}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">
                          {row.disponibilidad_min != null
                            ? <span className="font-mono text-xs text-slate-600">{fmtPct(row.disponibilidad_min)}–{fmtPct(row.disponibilidad_max)}</span>
                            : fmtPct(row.disponibilidad)}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">{row.inventario_total_m2 != null ? row.inventario_total_m2.toLocaleString('es-PA') : '—'}</td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">{row.absorc_neta_trim_m2 != null ? row.absorc_neta_trim_m2.toLocaleString('es-PA') : '—'}</td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">
                          {row.cap_rate_min != null
                            ? <span className="font-mono text-xs text-slate-600">{fmtPct(row.cap_rate_min)}–{fmtPct(row.cap_rate_max)}</span>
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
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Por Clase</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Clase</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Renta (USD/m²/mes)</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Inventario Total (m²)</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Disponibilidad Prom.</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Subzonas</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.by_tipo.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30">
                      <td className="py-2 px-3 font-semibold text-slate-700">{row.tipo}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-700">
                        {row.renta_max != null
                          ? <span className="font-mono text-xs text-slate-600">{fmt(row.renta_min)}–{fmt(row.renta_max)}</span>
                          : fmt(row.renta_min)}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-700">{row.inventario_total_m2 != null ? Math.round(row.inventario_total_m2).toLocaleString('es-PA') : '—'}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-700">{row.disponibilidad_avg != null ? fmtPct(row.disponibilidad_avg) : '—'}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-700">{row.subzona_count}</td>
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
                  color:  '#10b981',
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
                    color:  '#1e293b',
                  }]}
                />
              )}
            </>
          )}

          {/* Print footer */}
          <div className="print-only text-xs text-slate-400 text-center mt-4">
            Fuente: Base de datos ETRA · {new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

        </div>
      )}
    </div>
  );
}
