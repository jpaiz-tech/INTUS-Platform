import { useState, useEffect } from 'react';
import ReportView from './ReportView.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

const PHASES = [
  { pct: 15,  label: 'Investigando sector…',                     sub: 'Agent 1 — búsqueda y análisis de industria' },
  { pct: 45,  label: 'Revisando calidad de datos…',              sub: 'Agent 2 — QA y validación de evidencia' },
  { pct: 78,  label: 'Calculando score y actualizando datos…',   sub: 'Agent 3 — scoring + dashboard update' },
  { pct: 100, label: 'Reporte listo',                            sub: '' },
];

export default function ResearchPanel({ onSectorAdded }) {
  const [status,       setStatus]       = useState(null);
  const [industry,     setIndustry]     = useState('');
  const [reType,       setReType]       = useState('');
  const [company,      setCompany]      = useState('');
  const [formError,    setFormError]    = useState('');

  // Pipeline state
  const [phase,        setPhase]        = useState(0);  // 0=idle 1-3=running 4=done -1=error
  const [phaseError,   setPhaseError]   = useState(null);
  const [sectorResult, setSectorResult] = useState(null);
  const [resultDate,   setResultDate]   = useState(null);
  const [savedA1RunId, setSavedA1RunId] = useState(null);
  const [savedA2RunId, setSavedA2RunId] = useState(null);
  const [savedA1Run,   setSavedA1Run]   = useState(null);
  const [savedA2Run,   setSavedA2Run]   = useState(null);

  useEffect(() => {
    fetch(`${BASE}/api/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const ready = status?.mode === 'claude-api';
  const canSubmit = !phase && (industry.trim() || company.trim());

  async function runPipeline(e) {
    e.preventDefault();
    setFormError('');
    const industryVal = industry.trim();
    const companyVal  = company.trim();
    if (!industryVal && !companyVal) {
      setFormError('Al menos uno de los campos es requerido: Industria o Compañía.');
      return;
    }

    setPhase(1);
    setPhaseError(null);
    setSectorResult(null);
    setResultDate(null);

    // ── Agent 1 ──
    let a1RunId, a1Run;
    try {
      const res  = await fetch(`${BASE}/api/research`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: industryVal, realEstateType: reType.trim(), company: companyVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      a1RunId = data.run.id;
      a1Run   = data.run;
      setSavedA1RunId(a1RunId);
      setSavedA1Run(a1Run);
    } catch (err) {
      setPhase(-1);
      setPhaseError(`Agent 1 falló: ${err.message}`);
      return;
    }

    setPhase(2);

    // ── Agent 2 ──
    let a2RunId, a2Run;
    try {
      const res  = await fetch(`${BASE}/api/agent2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: a1RunId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      a2RunId = data.run.id;
      a2Run   = data.run;
      setSavedA2RunId(a2RunId);
      setSavedA2Run(a2Run);
    } catch (err) {
      setPhase(-1);
      setPhaseError(`Agent 2 falló: ${err.message}`);
      return;
    }

    setPhase(3);

    // ── Agent 3 ──
    try {
      const res  = await fetch(`${BASE}/api/agent3`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent1RunId:   a1RunId,
          agent2RunId:   a2RunId,
          agent1RunData: a1Run,
          agent2RunData: a2Run,
          updateDashboard:    true,
          dashboardWriteMode: 'copy',
          overwriteExisting:  true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.run?.sectorObject) {
        setSectorResult(data.run.sectorObject);
        setResultDate(data.run.createdAt);
      }
      if (data.run?.status === 'completed' && onSectorAdded) {
        onSectorAdded();
      }
    } catch (err) {
      setPhase(-1);
      setPhaseError(`Agent 3 falló: ${err.message}`);
      return;
    }

    setPhase(4);
  }

  function reset() {
    setPhase(0);
    setPhaseError(null);
    setSectorResult(null);
    setResultDate(null);
    setFormError('');
    setSavedA1RunId(null);
    setSavedA2RunId(null);
    setSavedA1Run(null);
    setSavedA2Run(null);
  }

  async function handleRetry() {
    if (!savedA1RunId || !savedA2RunId) return;
    setPhase(3);
    setPhaseError(null);
    setSectorResult(null);
    setResultDate(null);
    try {
      const res  = await fetch(`${BASE}/api/agent3`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent1RunId:   savedA1RunId,
          agent2RunId:   savedA2RunId,
          agent1RunData: savedA1Run,
          agent2RunData: savedA2Run,
          updateDashboard:    true,
          dashboardWriteMode: 'copy',
          overwriteExisting:  true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.run?.sectorObject) {
        setSectorResult(data.run.sectorObject);
        setResultDate(data.run.createdAt);
      }
      if (data.run?.status === 'completed' && onSectorAdded) {
        onSectorAdded();
      }
    } catch (err) {
      setPhase(-1);
      setPhaseError(`Agent 3 falló: ${err.message}`);
      return;
    }
    setPhase(4);
  }

  const currentPhaseCfg = phase >= 1 && phase <= 4 ? PHASES[phase - 1] : null;
  const pct = currentPhaseCfg?.pct ?? 0;

  // ── Render ──

  if (phase === 4 && sectorResult) {
    return (
      <div className="rp-wrap">
        <div className="rp-done-bar">
          <span className="rp-done-label">Análisis completado</span>
          <button className="rp-new-btn" onClick={reset}>+ Nueva investigación</button>
        </div>
        <div className="rp-paper-wrap">
          <ReportView sectorName={sectorResult.name} />
        </div>
      </div>
    );
  }

  if (phase === -1) {
    const canRetryAgent3 = savedA1RunId && savedA2RunId && phaseError?.includes('Agent 3');
    return (
      <div className="rp-wrap">
        <div className="rp-error-card">
          <div className="rp-error-title">Error en el pipeline</div>
          <div className="rp-error-msg">{phaseError}</div>
          <div className="error-actions">
            {canRetryAgent3 && (
              <button className="rp-retry-btn btn-secondary" onClick={handleRetry}>
                ↻ Reintentar Agent 3
              </button>
            )}
            <button className="rp-retry-btn btn-ghost" onClick={reset}>← Volver al formulario</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase >= 1 && phase <= 3) {
    return (
      <div className="rp-wrap">
        <div className="rp-progress-card">
          <div className="rp-progress-title">Generando reporte de industria…</div>

          <div className="rp-steps">
            {PHASES.slice(0, 3).map((p, i) => {
              const stepNum  = i + 1;
              const done     = phase > stepNum;
              const active   = phase === stepNum;
              return (
                <div key={i} className={`rp-step${done ? ' done' : active ? ' active' : ''}`}>
                  <div className="rp-step-dot">
                    {done ? '✓' : active ? <span className="rp-spinner" /> : stepNum}
                  </div>
                  <div className="rp-step-text">
                    <div className="rp-step-label">{p.label}</div>
                    {active && <div className="rp-step-sub">{p.sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rp-bar-track">
            <div className="rp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="rp-pct-label">{pct}%</div>
        </div>
      </div>
    );
  }

  // ── Phase 0: form ──
  const modeCss = ready ? 'claude' : 'mock';

  return (
    <div className="rp-wrap">
      <header className="rp-header">
        <div className="rp-logo">ETRA</div>
        <h1 className="rp-title">Industry Research Pipeline</h1>
        <p className="rp-subtitle">Análisis completo de industria · Score · Reporte descargable</p>
      </header>

      <div className={`status-banner ${modeCss}`}>
        {ready ? `Claude API — ${status?.model || 'claude'}` : 'API no configurada — contactar administrador'}
      </div>

      <form className="rp-form" onSubmit={runPipeline}>
        <div className="rp-fields">
          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-industry">
              Industria / Sector
              <span className="rp-hint">requerido si no hay compañía</span>
            </label>
            <input
              id="rp-industry"
              className="rp-input"
              type="text"
              value={industry}
              onChange={e => { setIndustry(e.target.value); setFormError(''); }}
              placeholder="ej. Cosméticos y Belleza"
              autoComplete="off"
            />
          </div>

          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-retype">
              Tipo de activo inmobiliario
              <span className="rp-hint">opcional</span>
            </label>
            <input
              id="rp-retype"
              className="rp-input"
              type="text"
              value={reType}
              onChange={e => setReType(e.target.value)}
              placeholder="ej. Retail, Industrial, Cold Storage"
              autoComplete="off"
            />
          </div>

          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-company">
              Operador de referencia
              <span className="rp-hint">opcional</span>
            </label>
            <input
              id="rp-company"
              className="rp-input"
              type="text"
              value={company}
              onChange={e => { setCompany(e.target.value); setFormError(''); }}
              placeholder="ej. Walmart, Tigo, Farmacias Arrocha"
              autoComplete="off"
            />
          </div>
        </div>

        {formError && <div className="rp-form-error">{formError}</div>}

        <button
          type="submit"
          className="rp-submit"
          disabled={!canSubmit || !ready}
        >
          {ready ? 'Generar reporte completo →' : 'API no disponible'}
        </button>
      </form>
    </div>
  );
}
