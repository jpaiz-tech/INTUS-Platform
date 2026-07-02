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
    <div className="mi-coverage-loading">
      <span className="mi-spinner" /> Cargando cobertura…
    </div>
  );
  if (error) return <div className="mi-chat-error">{error}</div>;
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
    <div className="mi-coverage-view">
      <div className="mi-coverage-header">
        <div className="mi-coverage-summary">
          <span className="mi-coverage-total">{total}</span>
          <span className="mi-coverage-total-label">registros en base de datos</span>
        </div>
        <input
          className="mi-filter-input mi-coverage-search"
          type="text"
          placeholder="Filtrar por país…"
          value={filterPais}
          onChange={e => setFilterPais(e.target.value)}
        />
      </div>

      {paisList.length === 0 && (
        <div className="mi-coverage-empty">No hay datos para "{filterPais}"</div>
      )}

      <div className="mi-coverage-tree">
        {paisList.map(pais => {
          const stats     = paisStats(pais);
          const isOpen    = !!openPais[pais];
          const sectors   = Object.keys(grouped[pais] || {}).sort();

          return (
            <div key={pais} className="mi-cov-country">
              <button
                className={`mi-cov-country-btn${isOpen ? ' open' : ''}`}
                onClick={() => togglePais(pais)}
              >
                <span className="mi-cov-arrow">{isOpen ? '▾' : '▸'}</span>
                <span className="mi-cov-country-name">{pais}</span>
                <span className="mi-cov-chips">
                  <span className="mi-cov-chip">{stats.sectors} sector{stats.sectors !== 1 ? 'es' : ''}</span>
                  <span className="mi-cov-chip mi-cov-chip--dim">{stats.periods} períodos</span>
                </span>
              </button>

              {isOpen && (
                <div className="mi-cov-sectors">
                  {sectors.map(sector => {
                    const sectorKey = `${pais}__${sector}`;
                    const isOpenS   = !!openSector[sectorKey];
                    const ciudades  = grouped[pais][sector] || {};
                    const ciudadList = Object.keys(ciudades).sort();

                    return (
                      <div key={sector} className="mi-cov-sector">
                        <button
                          className={`mi-cov-sector-btn${isOpenS ? ' open' : ''}`}
                          onClick={() => toggleSector(sectorKey)}
                        >
                          <span className="mi-cov-arrow">{isOpenS ? '▾' : '▸'}</span>
                          <span className="mi-cov-sector-name">{sector}</span>
                          <span className="mi-cov-chips">
                            <span className="mi-cov-chip mi-cov-chip--dim">{ciudadList.length} ciudad{ciudadList.length !== 1 ? 'es' : ''}</span>
                          </span>
                        </button>

                        {isOpenS && (
                          <div className="mi-cov-cities">
                            {ciudadList.map(ciudad => {
                              const periodos = [...ciudades[ciudad]].sort().reverse();
                              return (
                                <div key={ciudad} className="mi-cov-city-row">
                                  <span className="mi-cov-city-name">{ciudad}</span>
                                  <div className="mi-cov-periods">
                                    {periodos.map(p => (
                                      <span key={p} className="mi-cov-period-tag">{p}</span>
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
