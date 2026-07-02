import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, authDisabled } from './lib/AuthContext.jsx';
import { installApiAuth } from './lib/api.js';
import { loadProjects, saveProjects } from './lib/projectsStore.js';
import LoginPage from './components/LoginPage.jsx';
import { IntusLogo, Ic, ic } from './legacy/ui.jsx';
import { HubView } from './legacy/Hub.jsx';
import { Platform } from './legacy/Platform.jsx';
import { MapView } from './legacy/MapView.jsx';
import { ReferencialesView } from './legacy/Referenciales.jsx';
import CapitalResearch from './modules/capital-research/CapitalResearch.jsx';

installApiAuth();

// ══════════════════════════════════════════
// ROOT APP — INTUS PLATFORM (unified)
// Shell logic ported from intus_platform_1.html App(); storage moved from
// IndexedDB to Supabase (localStorage fallback in modo local).
// ══════════════════════════════════════════
export default function App() {
  const { session, signOut } = useAuth();

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-slate-400">Cargando INTUS Platform...</div>
        </div>
      </div>
    );
  }
  if (session === null) return <LoginPage />;
  return <Shell session={session} signOut={signOut} />;
}

function Shell({ session, signOut }) {
  const [pjs, setPjs] = useState([]);
  const [mainTab, setMainTab] = useState('hub');
  const [openProjectId, setOpenProjectId] = useState(null);
  const [storeReady, setStoreReady] = useState(false);
  const [storeError, setStoreError] = useState(null);
  const prevRef = useRef([]);

  useEffect(() => {
    loadProjects()
      .then((loaded) => { prevRef.current = loaded; setPjs(loaded); setStoreReady(true); })
      .catch((e) => { setStoreError(e.message); setStoreReady(true); });
  }, []);

  const sv = useCallback((np) => {
    setPjs(np);
    const prev = prevRef.current;
    prevRef.current = np;
    saveProjects(np, prev)
      .then(() => setStoreError(null))
      .catch((e) => setStoreError(e.message));
  }, []);

  // Global callback for map popups (legacy behavior)
  useEffect(() => {
    window.__openProject = (id) => {
      const p = pjs.find((x) => String(x.id) === String(id));
      if (p) { setOpenProjectId(p); setMainTab('platform'); }
    };
  }, [pjs]);

  const clearInitial = () => setOpenProjectId(null);

  // Count referenciales (hardcoded data in ReferencialesView — legacy behavior)
  const refsCount = 12;

  const handleHubNav = (tab, data) => {
    if (tab === '_import' && data) { sv(data); return; }
    setMainTab(tab);
  };

  const tabs = [
    { id: 'hub', label: 'Hub', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { id: 'platform', label: 'Prefactibilidad', icon: ic.chart },
    { id: 'map', label: 'Mapa Estratégico', icon: ic.map },
    { id: 'refs', label: 'Referenciales', icon: ic.land },
    { id: 'research', label: 'Capital Research', icon: ic.dollar },
  ];

  if (!storeReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-slate-400">Cargando INTUS Platform...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* GLOBAL HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[1000]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IntusLogo size={28} />
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <span className="hidden sm:block text-xs font-medium text-emerald-500 tracking-wide">Platform</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setMainTab(t.id)} className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-all ${mainTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Ic d={t.icon} s={14} /><span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-[11px] text-slate-400">{session.user.email}</span>
            {!authDisabled && (
              <button onClick={signOut} className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-red-500 border border-slate-200 rounded-lg transition-colors">Salir</button>
            )}
          </div>
        </div>
      </header>

      {/* Status banners */}
      {authDisabled && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center text-[11px] text-amber-700">
          Modo local — Supabase no configurado. Los datos se guardan solo en este navegador. Configura <span className="font-mono font-semibold">frontend/.env</span> para activar la nube y el login.
        </div>
      )}
      {storeError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-1.5 text-center text-[11px] text-red-600">
          Error de sincronización con Supabase: {storeError}
        </div>
      )}

      {mainTab === 'hub' && <HubView pjs={pjs} refsCount={refsCount} onNav={handleHubNav} />}
      {mainTab === 'platform' && <Platform pjs={pjs} setPjs={setPjs} sv={sv} initialProject={openProjectId} onClearInitial={clearInitial} />}
      {mainTab === 'map' && <MapView projects={pjs} onOpenProject={(id) => { const p = pjs.find((x) => String(x.id) === String(id)); if (p) { setOpenProjectId(p); setMainTab('platform'); } }} />}
      {mainTab === 'refs' && <ReferencialesView />}
      {/* Kept mounted (CSS-hidden) so in-progress work in Capital Research
          survives navigating to other modules (same pattern the dashboard
          app used for Market Intel). */}
      <div style={{ display: mainTab === 'research' ? 'block' : 'none' }}>
        <CapitalResearch active={mainTab === 'research'} />
      </div>

      <div className="mt-8 pb-6 text-center"><div className="text-[11px] text-slate-300">INTUS Platform · {new Date().getFullYear()}</div></div>
    </div>
  );
}
