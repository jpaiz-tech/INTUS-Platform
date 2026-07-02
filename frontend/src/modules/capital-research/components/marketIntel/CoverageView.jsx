import { useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_BASE || '';

export default function CoverageView() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [openPais,   setOpenPais]   = useState({});
  const [openSector, setOpenSector] = useState({});
  const [filterPais, setFilterPais] = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/market-data/coverage`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  function togglePais(p) {
    setOpenPais(prev => ({ ...prev, [p]: !prev[p] }));
  }
  function toggleSector(key) {
    setOpenSector(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <span className="inline-block w-4 h-4 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /> Cargando cobertura…
    </div>
  );
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3">{error}</div>;
  if (!data)  return null;

  const { total, grouped } = data;
  const paisList = Object.keys(grouped).filter(p =>
    !filterPais || p.toLowerCase().includes(filterPais.toLowerCase())
  ).sort();

  // Count sectors + periods per country for the summary chip
  function paisStats(pais) {
    const sectors = Object.keys(grouped[pais] || {});
    let periods = 0;
    for (const s of sectors) {
      for (const ciudades of Object.values(grouped[pais][s] || {})) {
        periods += ciudades.length;
      }
    }
    return { sectors: sectors.length, periods };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-800 font-mono">{total}</span>
          <span className="text-xs text-slate-400">registros en base de datos</span>
        </div>
        <input
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 w-56"
          type="text"
          placeholder="Filtrar por país…"
          value={filterPais}
          onChange={e => setFilterPais(e.target.value)}
        />
      </div>

      {paisList.length === 0 && (
        <div className="text-sm text-slate-400 text-center py-8">No hay datos para "{filterPais}"</div>
      )}

      <div className="flex flex-col gap-2">
        {paisList.map(pais => {
          const stats     = paisStats(pais);
          const isOpen    = !!openPais[pais];
          const sectors   = Object.keys(grouped[pais] || {}).sort();

          return (
            <div key={pais} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                onClick={() => togglePais(pais)}
              >
                <span className="text-slate-400 text-xs w-3">{isOpen ? '▾' : '▸'}</span>
                <span className="text-sm font-semibold text-slate-800 flex-1">{pais}</span>
                <span className="flex gap-2">
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{stats.sectors} sector{stats.sectors !== 1 ? 'es' : ''}</span>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">{stats.periods} períodos</span>
                </span>
              </button>

              {isOpen && (
                <div className="pl-6 pb-2 flex flex-col gap-1 border-t border-slate-100">
                  {sectors.map(sector => {
                    const sectorKey = `${pais}__${sector}`;
                    const isOpenS   = !!openSector[sectorKey];
                    const ciudades  = grouped[pais][sector] || {};
                    const ciudadList = Object.keys(ciudades).sort();

                    return (
                      <div key={sector}>
                        <button
                          className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-emerald-50/30 rounded-lg transition-colors"
                          onClick={() => toggleSector(sectorKey)}
                        >
                          <span className="text-slate-400 text-xs w-3">{isOpenS ? '▾' : '▸'}</span>
                          <span className="text-sm text-slate-700 flex-1">{sector}</span>
                          <span className="flex gap-2">
                            <span className="text-[11px] font-medium bg-slate-100 text-slate-400 rounded-full px-2 py-0.5">{ciudadList.length} ciudad{ciudadList.length !== 1 ? 'es' : ''}</span>
                          </span>
                        </button>

                        {isOpenS && (
                          <div className="pl-5 flex flex-col gap-1 pb-2">
                            {ciudadList.map(ciudad => {
                              const periodos = [...ciudades[ciudad]].sort().reverse();
                              return (
                                <div key={ciudad} className="flex items-center gap-2 py-1 text-xs">
                                  <span className="text-slate-600 font-medium w-32 shrink-0">{ciudad}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {periodos.map(p => (
                                      <span key={p} className="font-mono text-[11px] bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">{p}</span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
