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
    <div className="mi-panel">
      <header className="mi-header">
        <div className="mi-header-top">
          <div className="rp-logo">ETRA</div>
          <div className="mi-header-text">
            <h1 className="mi-title">Inteligencia de Mercado</h1>
            <p className="mi-subtitle">Datos reales de mercado · Solo lo que está en la base de datos</p>
          </div>
          {sheetConnected !== null && (
            <div className="mi-sheet-sync">
              <span className={`mi-sheet-dot ${sheetConnected ? 'connected' : 'disconnected'}`} />
              <span className="mi-sheet-label">
                {sheetConnected ? 'Google Sheets conectado' : 'Sheet no configurado'}
              </span>
              {sheetConnected && (
                <button
                  className="mi-sync-btn"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? 'Sincronizando…' : '↻ Sincronizar Sheet'}
                </button>
              )}
              {syncMsg && <span className="mi-sync-msg">{syncMsg}</span>}
            </div>
          )}
        </div>
        <div className="mi-view-toggle">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={`mi-toggle-btn${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mi-content">
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
