import { useState } from 'react';
import MiniChart from './MiniChart.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

function MetricCard({ card }) {
  return (
    <div className={`mi-card${card.missing ? ' mi-card-missing' : ''}`}>
      <div className="mi-card-label">{card.label}</div>
      {card.missing ? (
        <div className="mi-card-value mi-card-na">—</div>
      ) : (
        <div className="mi-card-value">{card.value}<span className="mi-card-unit">{card.unit}</span></div>
      )}
      {!card.missing && card.period && <div className="mi-card-meta">{card.period}</div>}
      {card.missing && <div className="mi-card-meta mi-card-no-data">sin datos</div>}
    </div>
  );
}

function DataTable({ table }) {
  if (!table) return null;
  return (
    <div className="mi-table-section">
      <div className="mi-section-label">{table.title}</div>
      <div className="mi-table-wrap">
        <table className="mi-table">
          <thead>
            <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => <td key={ci}>{cell ?? '—'}</td>)}
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
    if (line.startsWith('## ')) return <h3 key={i} className="mi-report-h2">{line.slice(3)}</h3>;
    if (line.startsWith('# '))  return <h2 key={i} className="mi-report-h1">{line.slice(2)}</h2>;
    if (line.startsWith('- '))  return <li key={i} className="mi-report-li">{line.slice(2)}</li>;
    if (line.trim() === '')     return <br key={i} />;
    return <p key={i} className="mi-report-p">{line}</p>;
  });

  return (
    <div className="mi-report-section">
      <button className="mi-report-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Ocultar reporte completo' : '▼ Ver reporte completo'}
      </button>
      {open && <div className="mi-report-body">{rendered}</div>}
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
    <div className="mi-response">
      {interpreted_as && (
        <div className="mi-interpreted">
          <span className="mi-interpreted-label">Interpretado como:</span> {interpreted_as}
          {rows_used != null && (
            <span className="mi-rows-badge">{rows_used} {rows_used === 1 ? 'registro' : 'registros'}</span>
          )}
        </div>
      )}

      {summary && <div className="mi-summary">{summary}</div>}

      {metric_cards.length > 0 && (
        <div className="mi-cards-grid">
          {metric_cards.map((card, i) => <MetricCard key={i} card={card} />)}
        </div>
      )}

      <DataTable table={table} />

      {charts.length > 0 && (
        <div className="mi-charts-section">
          {charts.map((chart, i) => (
            <MiniChart key={i} type={chart.type} title={chart.title} labels={chart.labels} datasets={chart.datasets} />
          ))}
        </div>
      )}

      {gaps.length > 0 && (
        <div className="mi-gaps">
          <div className="mi-section-label">Datos faltantes</div>
          <ul className="mi-gaps-list">
            {gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mi-sources">
          <div className="mi-section-label">Fuentes</div>
          <ul className="mi-sources-list">
            {sources.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      <ReportSection md={report_md} />

      <div className="mi-export-bar">
        <button className="mi-export-btn" onClick={handlePrintReport}>↓ Imprimir / PDF</button>
        <button className="mi-export-btn mi-export-btn-ghost" onClick={handleExportCSV}>↓ Exportar CSV</button>
      </div>
    </div>
  );
}
