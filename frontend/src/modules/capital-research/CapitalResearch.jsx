import { useEffect, useState, useCallback } from 'react';
import { fetchSectors } from './api.js';
import TopBar from './components/TopBar.jsx';
import WeightBar from './components/WeightBar.jsx';
import TierLegend from './components/TierLegend.jsx';
import RankList from './components/RankList.jsx';
import ArchGrid from './components/ArchGrid.jsx';
import ScoringTable from './components/ScoringTable.jsx';
import ResearchPanel from './components/ResearchPanel.jsx';
import HistorialPanel from './components/HistorialPanel.jsx';
import MarketIntelPanel from './components/marketIntel/MarketIntelPanel.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

async function downloadDashboardHtml() {
  const res = await fetch(`${BASE}/api/dashboard-html`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
    || 'etra-dashboard.html';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// "Investigación de Industrias" — ported faithfully from the source App.jsx
// Dashboard component (minus nav-brand / user email / signout, which the host
// shell handles).
function IndustriasSection() {
  const [activeTab,  setActiveTab]  = useState('investigacion');
  const [sectors,    setSectors]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [dlError,    setDlError]    = useState(null);
  const [dlLoading,  setDlLoading]  = useState(false);
  const [editMode,   setEditMode]   = useState(false);

  useEffect(() => {
    fetchSectors()
      .then(data => { setSectors(data); setLoading(false); })
      .catch(err  => { setError(err.message); setLoading(false); });
  }, []);

  const handleSectorAdded = useCallback(() => {
    fetchSectors()
      .then(data => setSectors(data))
      .catch(err => console.warn('Sector refresh failed:', err.message));
  }, []);

  async function handleDownload() {
    setDlLoading(true);
    setDlError(null);
    try {
      await downloadDashboardHtml();
    } catch (err) {
      setDlError(err.message);
    } finally {
      setDlLoading(false);
    }
  }

  async function handleDeleteSector(name) {
    const res = await fetch(`${BASE}/api/sectors/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    setSectors(prev => prev.filter(s => s.name !== name));
  }

  async function handleDeleteTab(sectorName, tabLabel) {
    const res = await fetch(
      `${BASE}/api/sectors/${encodeURIComponent(sectorName)}/tabs/${encodeURIComponent(tabLabel)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const result = await res.json();
    if (result.deletedSector) {
      setSectors(prev => prev.filter(s => s.name !== sectorName));
    } else {
      setSectors(prev => prev.map(s => s.name === sectorName ? result.sector : s));
    }
  }

  const innerTabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      className={
        activeTab === id
          ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2'
          : 'text-slate-400 hover:bg-slate-50 rounded-lg text-xs font-semibold px-4 py-2'
      }
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-white rounded-xl p-1 border border-slate-200 flex gap-1 w-fit mb-4">
          {innerTabBtn('investigacion', 'Investigación')}
          {innerTabBtn('dashboard', 'Dashboard')}
          {innerTabBtn('historial', 'Historial')}
        </div>
      </div>

      <div style={{ display: activeTab === 'investigacion' ? 'block' : 'none' }}>
        <ResearchPanel onSectorAdded={handleSectorAdded} />
      </div>

      {activeTab === 'dashboard' && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-5">
            <button
              className="bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
              onClick={handleDownload}
              disabled={dlLoading}
            >
              {dlLoading ? 'Descargando…' : '↓ Descargar HTML'}
            </button>
            <TopBar editMode={editMode} onToggleEdit={() => setEditMode(m => !m)} />
            {dlError && <span className="text-xs text-red-600">{dlError}</span>}
          </div>

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Marco de scoring — 6 dimensiones ponderadas</div>
          <WeightBar />
          <TierLegend />

          {loading && (
            <div className="py-10 text-center text-sm text-slate-400">
              Cargando sectores…
            </div>
          )}

          {error && (
            <div className="p-5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              Error: {error}
            </div>
          )}

          {!loading && !error && sectors.length > 0 && (
            <>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 mt-8">Ranking — Score compuesto</div>
              <RankList sectors={sectors} />

              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 mt-8">Ranking por tipo de activo</div>
              <p className="text-sm text-slate-500 italic -mt-1 mb-3.5 max-w-[880px] leading-relaxed">
                Cada tipo de activo agrupa los sectores con presencia en ese formato, ordenados por score compuesto. El promedio refleja la calidad del mix de inquilinos típico para ese tipo de inmueble.
              </p>
              <ArchGrid sectors={sectors} />

              <ScoringTable
                sectors={sectors}
                editMode={editMode}
                onDeleteSector={handleDeleteSector}
                onDeleteTab={handleDeleteTab}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'historial' && <HistorialPanel />}
    </>
  );
}

export default function CapitalResearch({ active }) {
  const [subTab, setSubTab] = useState('industrias');

  const tabBtn = (id, label) => (
    <button
      onClick={() => setSubTab(id)}
      className={
        subTab === id
          ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2'
          : 'text-slate-400 hover:bg-slate-50 rounded-lg text-xs font-semibold px-4 py-2'
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-white rounded-xl p-1 border border-slate-200 flex gap-1 w-fit">
          {tabBtn('industrias', 'Investigación de Industrias')}
          {tabBtn('mercado', 'Investigación de Mercado')}
        </div>
      </div>

      <div style={{ display: subTab === 'industrias' ? 'block' : 'none' }}>
        <IndustriasSection />
      </div>

      {/* Kept mounted (CSS-hidden) rather than unmounted on tab switch so
          in-progress work in Investigación de Mercado — like a PDF extraction
          or unreviewed proposed rows — survives navigating away. */}
      <div style={{ display: subTab === 'mercado' ? 'block' : 'none' }}>
        <MarketIntelPanel />
      </div>
    </div>
  );
}
