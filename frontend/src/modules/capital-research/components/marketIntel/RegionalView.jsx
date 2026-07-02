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
    <div className="flex flex-col gap-4">

      {/* Sector toggle */}
      <div className="no-print bg-white rounded-xl p-1 border border-slate-200 flex gap-1 w-fit">
        {SECTORS.map(s => (
          <button
            key={s}
            className={sector === s
              ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 transition-all'
              : 'text-slate-400 hover:bg-slate-50 rounded-lg text-xs font-semibold px-4 py-2 transition-all'}
            onClick={() => setSector(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3">{error}</div>}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
          <span className="inline-block w-4 h-4 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          <span>Cargando comparativo regional…</span>
        </div>
      )}

      {!loading && countries.length === 0 && !error && (
        <div className="text-sm text-slate-400 text-center py-8">
          No hay datos de {sector} cargados en la base de datos.
        </div>
      )}

      {!loading && countries.length > 0 && (
        <div className="flex flex-col gap-4">

          {/* Summary table */}
          <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">País</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Período</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Renta (USD/m²/mes)</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Disponibilidad</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Inventario (m²)</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Absorción Neta (m²)</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Cap Rate</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">Subzonas</th>
                </tr>
              </thead>
              <tbody>
                {countries.map((c, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-emerald-50/30">
                    <td className="py-2 px-3 font-semibold text-slate-700">{c.pais}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">{c.latest_periodo || '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">
                      {c.renta_prom_m2_mes_max != null
                        ? <span className="font-mono text-xs text-slate-600">{fmt(c.renta_prom_m2_mes)}–{fmt(c.renta_prom_m2_mes_max)}</span>
                        : fmt(c.renta_prom_m2_mes)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">
                      {c.disponibilidad_max != null
                        ? <span className="font-mono text-xs text-slate-600">{fmtPct(c.disponibilidad)}–{fmtPct(c.disponibilidad_max)}</span>
                        : fmtPct(c.disponibilidad)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">{c.inventario_total_m2 != null ? c.inventario_total_m2.toLocaleString('es-PA') : '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">
                      {c.absorc_neta_trim_m2 != null
                        ? (c.absorc_neta_trim_m2 >= 0 ? '+' : '') + c.absorc_neta_trim_m2.toLocaleString('es-PA')
                        : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">
                      {c.cap_rate_max != null
                        ? <span className="font-mono text-xs text-slate-600">{fmtPct(c.cap_rate)}–{fmtPct(c.cap_rate_max)}</span>
                        : fmtPct(c.cap_rate)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">{c.subzona_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comparison bar charts */}
          {withRenta.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MiniChart
                type="bar"
                title={`Renta Promedio — ${sector}`}
                labels={chartLabels}
                datasets={[{
                  label:  'Renta (USD/m²/mes)',
                  values: countries.map(c => c.renta_prom_m2_mes),
                  color:  '#10b981',
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
                    color:  '#1e293b',
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
