import { useState } from 'react';
import MiniChart from './MiniChart.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

function MetricCard({ card }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 ${card.missing ? 'opacity-50' : ''}`}>
      <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">{card.label}</div>
      {card.missing ? (
        <div className="text-xl font-bold text-slate-300 font-mono">—</div>
      ) : (
        <div className="text-xl font-bold text-slate-800 font-mono">{card.value}<span className="text-xs text-slate-400 ml-1">{card.unit}</span></div>
      )}
      {!card.missing && card.period && <div className="text-[11px] text-slate-400 mt-1">{card.period}</div>}
      {card.missing && <div className="text-[11px] text-slate-300 mt-1">sin datos</div>}
    </div>
  );
}

function DataTable({ table }) {
  if (!table) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{table.title}</div>
      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200">
              {table.headers.map((h, i) => <th key={i} className="text-left py-2 px-3 text-xs font-bold text-slate-400 uppercase">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 hover:bg-emerald-50/30">
                {row.map((cell, ci) => <td key={ci} className="py-2 px-3 font-mono text-xs text-slate-700">{cell ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportSection({ md }) {
  const [open, setOpen] = useState(false);
  if (!md) return null;

  const lines = md.split('\n');
  const rendered = lines.map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-slate-700 mt-2">{line.slice(3)}</h3>;
    if (line.startsWith('# '))  return <h2 key={i} className="text-base font-bold text-slate-800 mt-2">{line.slice(2)}</h2>;
    if (line.startsWith('- '))  return <li key={i} className="text-sm text-slate-600 ml-4 list-disc">{line.slice(2)}</li>;
    if (line.trim() === '')     return <br key={i} />;
    return <p key={i} className="text-sm text-slate-600">{line}</p>;
  });

  return (
    <div className="border-t border-slate-100 pt-3">
      <button className="text-xs font-semibold text-emerald-600 hover:underline" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Ocultar reporte completo' : '▼ Ver reporte completo'}
      </button>
      {open && <div className="mt-3 flex flex-col gap-1">{rendered}</div>}
    </div>
  );
}

export default function ResponseCard({ response, query }) {
  if (!response) return null;

  const { interpreted_as, summary, metric_cards = [], table, charts = [], sources = [], gaps = [], report_md, rows_used } = response;

  function handleExportCSV() {
    if (!query) return;
    // Build filter params from the interpreted query — just open the export endpoint
    const url = `${BASE}/api/market-data/export`;
    window.open(url, '_blank');
  }

  function handlePrintReport() {
    window.print();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 flex flex-col gap-4">
      {interpreted_as && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-600">Interpretado como:</span> {interpreted_as}
          {rows_used != null && (
            <span className="text-[11px] font-mono bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 ml-auto">{rows_used} {rows_used === 1 ? 'registro' : 'registros'}</span>
          )}
        </div>
      )}

      {summary && <div className="text-sm text-slate-700 leading-relaxed">{summary}</div>}

      {metric_cards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {metric_cards.map((card, i) => <MetricCard key={i} card={card} />)}
        </div>
      )}

      <DataTable table={table} />

      {charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {charts.map((chart, i) => (
            <MiniChart key={i} type={chart.type} title={chart.title} labels={chart.labels} datasets={chart.datasets} />
          ))}
        </div>
      )}

      {gaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Datos faltantes</div>
          <ul className="list-disc list-inside text-xs text-amber-700 flex flex-col gap-1">
            {gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fuentes</div>
          <ul className="list-disc list-inside text-xs text-slate-500 flex flex-col gap-1">
            {sources.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      <ReportSection md={report_md} />

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button className="border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-4 py-2 hover:border-emerald-300 hover:text-emerald-600 transition-all" onClick={handlePrintReport}>↓ Imprimir / PDF</button>
        <button className="text-slate-400 hover:text-emerald-600 text-xs font-semibold transition-all" onClick={handleExportCSV}>↓ Exportar CSV</button>
      </div>
    </div>
  );
}
