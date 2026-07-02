import { useState, useEffect } from 'react';
import ManualResearch from './ManualResearch.jsx';
import './App.css';

const BASE = 'https://industry-report-production.up.railway.app';

const MODE_LABELS = {
  'claude-api': 'Claude API mode — real API call',
  'mock-api':   'Mock API mode — no real Claude call',
};

const MODE_CSS = {
  'claude-api': 'claude',
  'mock-api':   'mock',
};

const RESEARCH_MODE_LABELS = {
  industry:                     'Industry',
  industry_type:                'Industry + Real Estate Type',
  company:                      'Company',
  company_type:                 'Company + Real Estate Type',
  industry_company:             'Industry + Company',
  industry_company_type:        'Industry + Company + Type',
  existing_sector_new_type:     'Add-on: New Type',
  existing_sector_company:      'Add-on: Company Angle',
  existing_sector_company_type: 'Add-on: Company + Type',
};

export default function App() {
  const [status,        setStatus]        = useState(null);
  const [industry,      setIndustry]      = useState('');
  const [realEstateType, setRealEstateType] = useState('');
  const [company,       setCompany]       = useState('');
  const [formError,     setFormError]     = useState('');
  const [loading,       setLoading]       = useState(false);
  const [run,           setRun]           = useState(null);
  const [error,         setError]         = useState(null);
  const [run2,          setRun2]          = useState(null);
  const [loading2,      setLoading2]      = useState(false);
  const [error2,        setError2]        = useState(null);
  const [run3,          setRun3]          = useState(null);
  const [loading3,      setLoading3]      = useState(false);
  const [error3,        setError3]        = useState(null);

  // Fetch backend mode on load
  useEffect(() => {
    fetch(`${BASE}/api/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const industryVal       = industry.trim();
    const realEstateTypeVal = realEstateType.trim();
    const companyVal        = company.trim();

    if (!industryVal && !companyVal) {
      setFormError('At least one of Industry or Company is required.');
      return;
    }

    setLoading(true);
    setRun(null);
    setRun2(null);
    setRun3(null);
    setError(null);
    setError2(null);
    setError3(null);

    let agent1RunId = null;
    try {
      const res  = await fetch(`${BASE}/api/research`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          industry:      industryVal,
          realEstateType: realEstateTypeVal,
          company:       companyVal,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Server error: ${res.status}`);
        if (data.run) setRun(data.run);
        return;
      }
      setRun(data.run);
      agent1RunId = data.run.id;
    } catch (err) {
      setError(`Could not reach backend: ${err.message}`);
      return;
    } finally {
      setLoading(false);
    }

    if (agent1RunId) await handleAgent2(agent1RunId);
  }

  async function handleAgent2(a1RunId) {
    const runId = a1RunId ?? run?.id;
    if (!runId) return;
    setLoading2(true);
    setRun2(null);
    setError2(null);

    let agent2RunId = null;
    try {
      const res  = await fetch(`${BASE}/api/agent2`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ runId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError2(data.error || `Server error: ${res.status}`);
        if (data.run) setRun2(data.run);
        return;
      }
      setRun2(data.run);
      agent2RunId = data.run.id;
    } catch (err) {
      setError2(`Could not reach backend: ${err.message}`);
      return;
    } finally {
      setLoading2(false);
    }

    if (agent2RunId) await handleAgent3(runId, agent2RunId);
  }

  async function handleAgent3(a1RunId, a2RunId) {
    const agent1RunId = a1RunId ?? run?.id;
    const agent2RunId = a2RunId ?? run2?.id;
    if (!agent1RunId || !agent2RunId) return;
    setLoading3(true);
    setRun3(null);
    setError3(null);

    try {
      const res  = await fetch(`${BASE}/api/agent3`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agent1RunId,
          agent2RunId,
          updateDashboard:    true,
          dashboardWriteMode: 'copy',
          overwriteExisting:  false,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError3(data.error || `Server error: ${res.status}`);
        if (data.run) setRun3(data.run);
        return;
      }
      setRun3(data.run);
    } catch (err) {
      setError3(`Could not reach backend: ${err.message}`);
    } finally {
      setLoading3(false);
    }
  }

  const backendMode = status?.mode ?? null;
  const modeCss     = MODE_CSS[backendMode]    ?? 'mock';
  const modeLabel   = MODE_LABELS[backendMode] ?? (backendMode ?? 'Connecting…');

  const canSubmit = !loading && (industry.trim() || company.trim());

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">ETRA</div>
        <h1>Industry Research Pipeline</h1>
        <p className="subtitle">Agent 1 — Sector Analysis</p>
      </header>

      {/* ── Backend mode badge ────────────────────────────── */}
      <div className={`status-banner ${modeCss}`} style={{ marginBottom: '0.25rem' }}>
        {modeLabel}
        {status?.model && (
          <span className="mode-model"> · {status.model}</span>
        )}
      </div>

      {/* ── Primary research form ─────────────────────────── */}
      <form className="research-form" onSubmit={handleSubmit}>
        <div className="form-fields">
          <div className="form-field">
            <label htmlFor="industry-input" className="form-label">
              Industry / Sector
              <span className="form-label-hint">required if no company</span>
            </label>
            <input
              id="industry-input"
              type="text"
              className="industry-input"
              value={industry}
              onChange={(e) => { setIndustry(e.target.value); setFormError(''); }}
              placeholder="e.g. Cosméticos y Belleza"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="re-type-input" className="form-label">
              Real Estate Type
              <span className="form-label-hint">optional</span>
            </label>
            <input
              id="re-type-input"
              type="text"
              className="industry-input"
              value={realEstateType}
              onChange={(e) => setRealEstateType(e.target.value)}
              placeholder="e.g. Retail, Industrial, Cold Storage"
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="company-input" className="form-label">
              Operador de Referencia (opcional)
            </label>
            <input
              id="company-input"
              type="text"
              className="industry-input"
              value={company}
              onChange={(e) => { setCompany(e.target.value); setFormError(''); }}
              placeholder="Opcional — ej. Walmart, Tigo, Arca de Noé"
              disabled={loading}
              autoComplete="off"
            />
            <p className="form-field-hint">Usado solo como fuente de investigación regional — no afecta el scoring del sector.</p>
          </div>
        </div>

        {formError && (
          <div className="form-error">{formError}</div>
        )}

        <div className="form-actions">
          <button
            type="submit"
            className="run-button"
            disabled={!canSubmit}
          >
            {loading ? 'Running Agent 1…' : 'Run Full Pipeline'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="status-banner loading">
          <span className="spinner" />
          Agent 1 — researching sector… (step 1 of 3)
        </div>
      )}

      {error && !loading && (
        <div className="status-banner error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {run && !loading && (
        <div className="result-container">
          <div className={`status-banner ${MODE_CSS[run.mode] ?? 'mock'}`}>
            {MODE_LABELS[run.mode] ?? run.mode}
          </div>

          {/* Overlap warning from dashboard context */}
          {run.dashboardOverlap?.possibleOverlap && (
            <div className="status-banner overlap-warning">
              <strong>Overlap warning:</strong> {run.dashboardOverlap.warning}
            </div>
          )}

          <div className="run-meta">
            <MetaItem label="Industry"       value={run.industry  || '—'} />
            {run.realEstateType && (
              <MetaItem label="RE Type"      value={run.realEstateType} />
            )}
            {run.company && (
              <MetaItem label="Company"      value={run.company} />
            )}
            {run.researchMode && (
              <MetaItem label="Scope"        value={RESEARCH_MODE_LABELS[run.researchMode] || run.researchMode} />
            )}
            <MetaItem label="Status"         value={run.status}   highlight={run.status} />
            <MetaItem label="Agent"          value={run.agent} />
            <MetaItem label="Model"          value={run.model} />
            <MetaItem label="Mode"           value={run.mode} />
            <MetaItem label="Created"        value={new Date(run.createdAt).toLocaleString()} />
            {run.usage?.input_tokens  != null && (
              <MetaItem label="Input tokens"  value={run.usage.input_tokens.toLocaleString()} />
            )}
            {run.usage?.output_tokens != null && (
              <MetaItem label="Output tokens" value={run.usage.output_tokens.toLocaleString()} />
            )}
            <MetaItem
              label="Web search"
              value={run.webSearchEnabled ? 'enabled' : 'disabled'}
            />
            {run.dashboardContextUsed && (
              <MetaItem
                label="Dashboard ctx"
                value={run.dashboardOverlap?.possibleOverlap ? 'overlap detected' : 'no overlap'}
              />
            )}
          </div>

          {run.status === 'completed' && run.rawOutput && (
            <div className="output-panel">
              <div className="output-label">Research Output</div>
              <pre className="output-text">{run.rawOutput}</pre>
            </div>
          )}

          {run.status === 'failed' && (
            <div className="output-panel error-panel">
              <div className="output-label">Error Detail</div>
              <pre className="output-text">{run.error}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── Agent 2 QA ───────────────────────────────────── */}
      {run && run.status === 'completed' && !loading && (
        <div className="agent2-trigger">
          <button
            className="run-button agent2-button"
            onClick={handleAgent2}
            disabled={loading2}
          >
            {loading2 ? 'Running Agent 2 QA…' : 'Run Agent 2 QA'}
          </button>
        </div>
      )}

      {loading2 && (
        <div className="status-banner loading">
          <span className="spinner" />
          Running Agent 2 QA — this may take 30–90 seconds…
        </div>
      )}

      {error2 && !loading2 && (
        <div className="status-banner error">
          <strong>Agent 2 Error:</strong> {error2}
        </div>
      )}

      {run2 && !loading2 && (
        <div className="result-container">
          <div className="output-label agent2-header">Agent 2 — QA &amp; Evidence Review</div>

          {run2.truncated && (
            <div className="status-banner error">
              Agent 2 output was cut off. Increase AGENT2_MAX_OUTPUT_TOKENS.
            </div>
          )}
          {run2.status === 'failed' && (
            <div className="status-banner error">
              Agent 2 failed: {run2.error}
            </div>
          )}

          <div className="run-meta">
            <MetaItem label="Agent"           value={run2.agent} />
            <MetaItem label="Parent Run ID"   value={run2.parentRunId} mono />
            <MetaItem label="Status"          value={run2.status} highlight={run2.status} />
            <MetaItem label="Model"           value={run2.model} />
            <MetaItem label="Web search"      value={run2.webSearchEnabled ? 'enabled' : 'disabled'} />
            {run2.webSearchEnabled && (
              <MetaItem label="WS max uses"   value={run2.webSearchMaxUses} />
            )}
            {run2.usage?.input_tokens  != null && (
              <MetaItem label="Input tokens"  value={run2.usage.input_tokens.toLocaleString()} />
            )}
            {run2.usage?.output_tokens != null && (
              <MetaItem label="Output tokens" value={run2.usage.output_tokens.toLocaleString()} />
            )}
            <MetaItem label="Created" value={new Date(run2.createdAt).toLocaleString()} />
          </div>

          {run2.rawOutput && (
            <div className="output-panel">
              <div className="output-label">Agent 2 Output</div>
              <pre className="output-text">{run2.rawOutput}</pre>
            </div>
          )}
        </div>
      )}

      {/* ── Agent 3 Scoring ──────────────────────────────── */}
      {run2 && run2.rawOutput && !loading && !loading2 && (
        <div className="agent2-trigger">
          <button
            className="run-button agent3-button"
            onClick={handleAgent3}
            disabled={loading3}
          >
            {loading3 ? 'Running Agent 3 scoring…' : 'Run Agent 3 + Generate Dashboard Copy'}
          </button>
        </div>
      )}

      {loading3 && (
        <div className="status-banner loading">
          <span className="spinner" />
          Running Agent 3 scoring and dashboard update — this may take 30–90 seconds…
        </div>
      )}

      {error3 && !loading3 && (
        <div className="status-banner error">
          <strong>Agent 3 Error:</strong> {error3}
        </div>
      )}

      {run3 && !loading3 && (
        <div className="result-container">
          <div className="output-label agent3-header">Agent 3 — Scoring &amp; Dashboard Update</div>

          {run3.status === 'truncated' && (
            <div className="status-banner error">
              Agent 3 output was cut off. Increase AGENT3_MAX_OUTPUT_TOKENS.
            </div>
          )}
          {run3.status === 'failed' && (
            <div className="status-banner error">
              Agent 3 failed: {run3.error}
            </div>
          )}
          {run3.warnings?.map((w, i) => (
            <div key={i} className="status-banner error">{w}</div>
          ))}

          {run3.dashboardUpdated && run3.dashboardWriteMode === 'copy' && run3.dashboardOutputUrl && (
            <div className="agent3-dashboard-link">
              <a
                href={`${BASE}${run3.dashboardOutputUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="run-button agent3-open-btn"
              >
                Open Updated Dashboard
              </a>
              <span className="agent3-path">{run3.dashboardOutputPath}</span>
            </div>
          )}

          <div className="run-meta">
            <MetaItem label="Agent"           value={run3.agent} />
            <MetaItem label="Status"          value={run3.status} highlight={run3.status} />
            <MetaItem label="Model"           value={run3.model} />
            {run3.parsedOutput?.finalScore != null && (
              <MetaItem label="Final Score"   value={`${run3.parsedOutput.finalScore} (${run3.parsedOutput.scoreExact})`} />
            )}
            {run3.parsedOutput?.tier && (
              <MetaItem label="Tier"          value={run3.parsedOutput.tier} />
            )}
            {run3.parsedOutput?.sectorAttractiveness && (
              <MetaItem label="Attractiveness" value={run3.parsedOutput.sectorAttractiveness} />
            )}
            {run3.parsedOutput?.executionSelectivity && (
              <MetaItem label="Execution"     value={run3.parsedOutput.executionSelectivity} />
            )}
            {run3.parsedOutput?.confidence && (
              <MetaItem label="Confidence"    value={run3.parsedOutput.confidence} />
            )}
            <MetaItem label="Dashboard"       value={run3.dashboardUpdated ? `updated (${run3.dashboardWriteMode})` : 'not updated'} />
            {run3.usage?.input_tokens  != null && (
              <MetaItem label="Input tokens"  value={run3.usage.input_tokens.toLocaleString()} />
            )}
            {run3.usage?.output_tokens != null && (
              <MetaItem label="Output tokens" value={run3.usage.output_tokens.toLocaleString()} />
            )}
            <MetaItem label="Created"         value={new Date(run3.createdAt).toLocaleString()} />
          </div>

          {run3.rawOutput && (
            <details className="agent3-details">
              <summary className="agent3-summary">Raw Agent 3 output</summary>
              <pre className="output-text">{run3.rawOutput}</pre>
            </details>
          )}

          {run3.sectorObject && (
            <details className="agent3-details">
              <summary className="agent3-summary">Parsed sector object</summary>
              <pre className="output-text">{JSON.stringify(run3.sectorObject, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {/* ── Manual Research — collapsed by default ────────── */}
      <details className="manual-details">
        <summary className="manual-summary">Manual mode (no API key)</summary>
        <ManualResearch />
      </details>
    </div>
  );
}

function MetaItem({ label, value, mono, highlight }) {
  const cls = highlight
    ? `meta-value meta-value--${highlight}`
    : `meta-value${mono ? ' mono' : ''}`;
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}
