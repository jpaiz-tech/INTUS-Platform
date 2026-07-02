import { useState, useEffect } from 'react';
import QueryView    from './QueryView.jsx';
import RegionalView from './RegionalView.jsx';
import CoverageView from './CoverageView.jsx';
import IngestView   from './IngestView.jsx';

const API = import.meta.env.VITE_API_BASE || '';

const VIEWS = [
  { id: 'query',    label: 'Consultas' },
  { id: 'regional', label: 'Comparativo' },
  { id: 'coverage', label: 'Cobertura' },
  { id: 'ingest',   label: 'Cargar Datos' },
];

export default function MarketIntelPanel() {
  const [view, setView] = useState('query');
  const [sheetConnected, setSheetConnected] = useState(null); // null=loading, true/false
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');

  useEffect(() => {
    fetch(`${API}/api/market-data/sheet-status`)
      .then(r => r.json())
      .then(d => setSheetConnected(d.connected))
      .catch(() => setSheetConnected(false));
  }, []);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg('');
    try {
      const r = await fetch(`${API}/api/market-data/sync-from-sheets`, { method: 'POST' });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setSyncMsg(`✓ Sincronizado: ${d.upserted} filas actualizadas`);
    } catch (err) {
      setSyncMsg(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
            ETRA
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Inteligencia de Mercado</h1>
            <p className="text-sm text-slate-400">Datos reales de mercado · Solo lo que está en la base de datos</p>
          </div>
          {sheetConnected !== null && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className={`w-2 h-2 rounded-full ${sheetConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className="text-slate-500">
                {sheetConnected ? 'Google Sheets conectado' : 'Sheet no configurado'}
              </span>
              {sheetConnected && (
                <button
                  className="border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-3 py-1.5 hover:border-emerald-300 hover:text-emerald-600 transition-all disabled:opacity-50"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? 'Sincronizando…' : '↻ Sincronizar Sheet'}
                </button>
              )}
              {syncMsg && <span className="text-slate-400">{syncMsg}</span>}
            </div>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl p-1 border border-slate-200 flex gap-1 w-fit">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={view === v.id
                ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 transition-all'
                : 'text-slate-400 hover:bg-white rounded-lg text-xs font-semibold px-4 py-2 transition-all'}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <div>
        {/* All views stay mounted so in-progress work (e.g. a PDF extraction
            or unreviewed proposed rows in Cargar Datos) survives switching
            tabs — only the active one is visible, inactive ones are hidden
            with CSS rather than unmounted. */}
        <div style={{ display: view === 'query' ? 'block' : 'none' }}><QueryView /></div>
        <div style={{ display: view === 'regional' ? 'block' : 'none' }}><RegionalView /></div>
        <div style={{ display: view === 'coverage' ? 'block' : 'none' }}><CoverageView /></div>
        <div style={{ display: view === 'ingest' ? 'block' : 'none' }}><IngestView /></div>
      </div>
    </div>
  );
}
