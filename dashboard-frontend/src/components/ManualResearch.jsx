import { useState } from 'react';

const BASE = import.meta.env.VITE_API_BASE || '';

export default function ManualResearch() {
  const [industry, setIndustry] = useState('');
  const [prompt, setPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [rawOutput, setRawOutput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedRun, setSavedRun] = useState(null);

  async function handleGeneratePrompt(e) {
    e.preventDefault();
    if (!industry.trim()) return;

    setPromptLoading(true);
    setPromptError(null);
    setPrompt('');
    setSavedRun(null);
    setCopied(false);

    try {
      const res = await fetch(`${BASE}/api/prompts/agent1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: industry.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromptError(data.error || `Server error: ${res.status}`);
        return;
      }
      setPrompt(data.prompt);
    } catch (err) {
      setPromptError(`Could not reach backend: ${err.message}`);
    } finally {
      setPromptLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById('prompt-preview');
      if (el) { el.select(); document.execCommand('copy'); }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!rawOutput.trim()) return;

    setSaveLoading(true);
    setSaveError(null);
    setSavedRun(null);

    try {
      const res = await fetch(`${BASE}/api/runs/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: industry.trim(),
          agent: 'agent1',
          rawOutput: rawOutput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || `Server error: ${res.status}`);
        return;
      }
      setSavedRun(data.run);
    } catch (err) {
      setSaveError(`Could not reach backend: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <section className="mode-section manual-section">
      <div className="mode-header">
        <span className="mode-badge manual-badge">Manual mode — no API key, no API cost</span>
        <h2 className="mode-title">Manual Research</h2>
        <p className="mode-desc">
          Generate the Agent 1 prompt, paste it into Claude manually, then paste the response back here to save it.
        </p>
      </div>

      <div className="manual-step">
        <div className="step-label">Step 1 — Generate prompt</div>
        <form className="research-form" onSubmit={handleGeneratePrompt}>
          <label htmlFor="manual-industry-input" className="form-label">
            Industry / Sector
          </label>
          <div className="input-row">
            <input
              id="manual-industry-input"
              type="text"
              className="industry-input"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Cosméticos y Belleza"
              disabled={promptLoading}
              autoComplete="off"
            />
            <button
              type="submit"
              className="run-button"
              disabled={promptLoading || !industry.trim()}
            >
              {promptLoading ? 'Generating…' : 'Generate Agent 1 Prompt'}
            </button>
          </div>
        </form>

        {promptError && (
          <div className="status-banner error" style={{ marginTop: '0.75rem' }}>
            <strong>Error:</strong> {promptError}
          </div>
        )}
      </div>

      {prompt && (
        <div className="manual-step">
          <div className="step-label">Step 2 — Copy prompt and paste into Claude</div>
          <div className="prompt-box">
            <div className="prompt-box-header">
              <span className="output-label" style={{ border: 'none', background: 'none', padding: 0 }}>
                Agent 1 Prompt
              </span>
              <button className="copy-button" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy Prompt'}
              </button>
            </div>
            <textarea
              id="prompt-preview"
              className="prompt-preview"
              readOnly
              value={prompt}
            />
          </div>
        </div>
      )}

      {prompt && (
        <div className="manual-step">
          <div className="step-label">Step 3 — Paste Claude's response and save</div>
          <form onSubmit={handleSave}>
            <label htmlFor="raw-output-input" className="form-label">
              Paste Claude Output Here
            </label>
            <textarea
              id="raw-output-input"
              className="output-input"
              value={rawOutput}
              onChange={(e) => setRawOutput(e.target.value)}
              placeholder="Paste the full Claude response here…"
              rows={16}
              disabled={saveLoading}
            />
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="submit"
                className="run-button save-button"
                disabled={saveLoading || !rawOutput.trim()}
              >
                {saveLoading ? 'Saving…' : 'Save Manual Output'}
              </button>
            </div>
          </form>

          {saveError && (
            <div className="status-banner error" style={{ marginTop: '0.75rem' }}>
              <strong>Error:</strong> {saveError}
            </div>
          )}
        </div>
      )}

      {savedRun && (
        <div className="result-container">
          <div className="status-banner manual-saved-banner">
            Manual mode — no API key, no API cost
          </div>
          <div className="run-meta">
            <ManualMetaItem label="Industry" value={savedRun.industry} />
            <ManualMetaItem label="Status" value={savedRun.status} highlight={savedRun.status} />
            <ManualMetaItem label="Mode" value={savedRun.mode} />
            <ManualMetaItem label="Model" value={savedRun.model} />
            <ManualMetaItem label="Run ID" value={savedRun.id} mono />
            <ManualMetaItem label="Created" value={new Date(savedRun.createdAt).toLocaleString()} />
          </div>
          <div className="output-panel">
            <div className="output-label">Saved Output</div>
            <pre className="output-text">{savedRun.rawOutput}</pre>
          </div>
        </div>
      )}
    </section>
  );
}

function ManualMetaItem({ label, value, mono, highlight }) {
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
