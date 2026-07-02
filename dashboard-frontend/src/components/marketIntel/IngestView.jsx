import { useState, useRef } from 'react';

const BASE = import.meta.env.VITE_API_BASE || '';

function ActionBadge({ action }) {
  const map = {
    insert:       ['INSERT',       'mi-badge-insert'],
    update:       ['UPDATE',       'mi-badge-update'],
    no_change:    ['SIN CAMBIOS',  'mi-badge-nochange'],
    sheet_locked: ['EN SHEET',     'mi-badge-sheetlock'],
  };
  const [label, cls] = map[action] || ['?', ''];
  return <span className={`mi-action-badge ${cls}`}>{label}</span>;
}

function ChangesList({ changes }) {
  if (!changes || Object.keys(changes).length === 0) return null;
  return (
    <div className="mi-changes">
      {Object.entries(changes).map(([field, { old: o, new: n }]) => (
        <div key={field} className="mi-change-row">
          <span className="mi-change-field">{field}</span>
          <span className="mi-change-old">{o ?? '—'}</span>
          <span className="mi-change-arrow">→</span>
          <span className="mi-change-new">{n ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function ProposedRow({ item, checked, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const { action, row, changes, possible_duplicate, similar_existing, matched_fields, missing_ciudad } = item;
  const isNoChange    = action === 'no_change';
  const isSheetLocked = action === 'sheet_locked';
  const isReadOnly    = isNoChange || isSheetLocked;

  return (
    <div className={`mi-proposed-row${isReadOnly ? ' mi-row-nochange' : ''}${isSheetLocked ? ' mi-row-sheetlock' : ''}${possible_duplicate ? ' mi-row-possible-dupe' : ''}${missing_ciudad ? ' mi-row-missing-ciudad' : ''}`}>
      <div className="mi-proposed-row-head">
        {!isReadOnly && (
          <input type="checkbox" className="mi-row-check" checked={checked} onChange={onToggle} />
        )}
        <ActionBadge action={action} />
        {possible_duplicate && <span className="mi-action-badge mi-badge-warning">POSIBLE DUPLICADO</span>}
        {missing_ciudad && <span className="mi-action-badge mi-badge-warning">SIN CIUDAD</span>}
        <span className="mi-row-id">
          {[row.pais, row.ciudad, row.subzona].filter(Boolean).join(' › ')}
          {' — '}<strong>{row.sector}</strong>
          {row.periodo && <span className="mi-row-period"> · {row.periodo}</span>}
        </span>
        <button className="mi-row-expand" onClick={() => setExpanded(o => !o)}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mi-proposed-row-detail">
          {missing_ciudad && (
            <div className="mi-duplicate-note">
              Este registro no tiene ciudad especificada (dato a nivel país). Verifica si el documento
              menciona una ciudad y agrégala manualmente antes de guardar, o confirma que es correcto
              dejarlo a nivel país.
            </div>
          )}
          {isSheetLocked && (
            <div className="mi-sheetlock-note">
              Este registro existe en Google Sheets. Para actualizarlo, edítalo directamente en la hoja y sincroniza.
              {changes && Object.keys(changes).length > 0 && ' El PDF tiene valores distintos — ve los detalles abajo.'}
            </div>
          )}
          {possible_duplicate && (
            <div className="mi-duplicate-note">
              Ya existe un registro muy similar para este submercado/período
              {similar_existing?.referencia && <> de <strong>{similar_existing.referencia}</strong></>}
              {' '}({matched_fields?.length || 0} valor{matched_fields?.length !== 1 ? 'es' : ''} coincidente{matched_fields?.length !== 1 ? 's' : ''}: {matched_fields?.join(', ')}).
              Verifica que no sea el mismo reporte extraído dos veces antes de guardar.
            </div>
          )}
          {(action === 'update' || isSheetLocked) && changes && Object.keys(changes).length > 0 && (
            <>
              <div className="mi-detail-label">{isSheetLocked ? 'Diferencias (solo lectura)' : 'Cambios propuestos'}</div>
              <ChangesList changes={changes} />
            </>
          )}
          <div className="mi-detail-label">Datos extraídos</div>
          <div className="mi-row-fields">
            {Object.entries(row).filter(([, v]) => v != null).map(([k, v]) => (
              <div key={k} className="mi-row-field">
                <span className="mi-field-key">{k}</span>
                <span className="mi-field-val">{String(v)}</span>
              </div>
            ))}
          </div>
          {row.info_resumen && (
            <div className="mi-row-resumen">
              <span className="mi-field-key">Notas:</span> {row.info_resumen}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IngestView() {
  const [mode,        setMode]        = useState('text');  // 'text' | 'pdf'
  const [text,        setText]        = useState('');
  const [pdfFile,     setPdfFile]     = useState(null);
  const [pdfBase64,   setPdfBase64]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [proposed,    setProposed]    = useState(null);
  const [sourceDesc,  setSourceDesc]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [selected,    setSelected]    = useState(new Set());
  const [commitLoad,  setCommitLoad]  = useState(false);
  const [committed,   setCommitted]   = useState(null);
  const [noRowsMsg,   setNoRowsMsg]   = useState(null);
  const [error,       setError]       = useState(null);
  const fileRef = useRef();

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      // Strip the "data:application/pdf;base64," prefix
      const base64 = dataUrl.split(',')[1];
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);
  }

  function toggleRow(i) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function selectAll() {
    const actionable = (proposed || [])
      .map((r, i) => (r.action === 'insert' || r.action === 'update') ? i : -1)
      .filter(i => i >= 0);
    setSelected(new Set(actionable));
  }

  // Rows flagged as possible duplicates are never pre-selected — the user
  // must open and review the warning before deciding to include them.
  function actionableAutoSelect(list) {
    return list
      .map((r, i) => (!r.possible_duplicate && (r.action === 'insert' || r.action === 'update')) ? i : -1)
      .filter(i => i >= 0);
  }

  function deselectAll() { setSelected(new Set()); }

  async function handleExtract(e) {
    e.preventDefault();
    setError(null);
    setProposed(null);
    setCommitted(null);
    setSelected(new Set());

    if (mode === 'text' && !text.trim()) return;
    if (mode === 'pdf'  && !pdfBase64)  return;

    setLoading(true);
    try {
      const body = mode === 'pdf'
        ? { pdf_base64: pdfBase64, source_type: 'pdf' }
        : { text, source_type: 'pasted_text' };

      const res  = await fetch(`${BASE}/api/market-data/ingest`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      const rows = data.proposed || [];
      setProposed(rows);
      setSourceDesc(data.source_description || '');
      setNotes(data.extraction_notes || '');
      setNoRowsMsg(rows.length === 0 ? (data.message || 'No se encontraron datos de mercado en este documento.') : null);

      // Pre-select insert/update rows only (not no_change, sheet_locked, or possible duplicates)
      setSelected(new Set(actionableAutoSelect(rows)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!proposed || selected.size === 0) return;
    setCommitLoad(true);
    setError(null);

    const confirmed_rows = [...selected].map(i => proposed[i]).filter(Boolean);
    try {
      const res  = await fetch(`${BASE}/api/market-data/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirmed_rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setCommitted(data.results);
      setProposed(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitLoad(false);
    }
  }

  function reset() {
    if (proposed && proposed.length > 0 && !window.confirm('¿Descartar todos los datos extraídos?')) return;
    setText(''); setPdfFile(null); setPdfBase64(null);
    setProposed(null); setCommitted(null); setError(null);
    setNoRowsMsg(null); setSelected(new Set()); setSourceDesc(''); setNotes('');
    if (fileRef.current) fileRef.current.value = '';
  }

  if (committed) {
    const inserted = committed.filter(r => r.action === 'inserted').length;
    const updated  = committed.filter(r => r.action === 'updated').length;
    return (
      <div className="mi-ingest-wrap">
        <div className="mi-committed">
          <div className="mi-committed-icon">✓</div>
          <div className="mi-committed-title">Datos guardados</div>
          <div className="mi-committed-sub">
            {inserted > 0 && <span>{inserted} registro{inserted !== 1 ? 's' : ''} nuevo{inserted !== 1 ? 's' : ''}</span>}
            {inserted > 0 && updated > 0 && ' · '}
            {updated  > 0 && <span>{updated} actualizado{updated !== 1 ? 's' : ''}</span>}
          </div>
          <button className="mi-chat-submit" style={{ marginTop: 20 }} onClick={reset}>+ Cargar más datos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mi-ingest-wrap">
      {!proposed && (
        <form className="mi-ingest-form" onSubmit={handleExtract}>
          <div className="mi-ingest-mode-bar">
            <button type="button" className={`mi-mode-btn${mode === 'text' ? ' active' : ''}`} onClick={() => setMode('text')}>
              Pegar texto
            </button>
            <button type="button" className={`mi-mode-btn${mode === 'pdf' ? ' active' : ''}`} onClick={() => setMode('pdf')}>
              Subir PDF
            </button>
          </div>

          {mode === 'text' && (
            <textarea
              className="mi-ingest-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Pega aquí el texto del reporte de mercado (CBRE, JLL, Colliers, Logan, etc.) o de encuestas a gestores. El sistema extraerá rentas, ocupación, cap rates, series de tiempo y más de forma estructurada."
              rows={10}
            />
          )}

          {mode === 'pdf' && (
            <div className="mi-file-drop" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
              {pdfFile ? (
                <div className="mi-file-selected">
                  <span className="mi-file-icon">📄</span>
                  <span className="mi-file-name">{pdfFile.name}</span>
                  <button type="button" className="mi-file-remove" onClick={e => { e.stopPropagation(); setPdfFile(null); setPdfBase64(null); }}>✕</button>
                </div>
              ) : (
                <div className="mi-file-placeholder">
                  <div className="mi-file-icon-lg">↑</div>
                  <div>Haz clic para seleccionar un PDF</div>
                  <div className="mi-file-hint">Reportes de mercado, market snapshots, estudios de broker</div>
                </div>
              )}
            </div>
          )}

          {error && <div className="mi-chat-error">{error}</div>}

          <button
            type="submit"
            className="mi-chat-submit"
            disabled={loading || (mode === 'text' ? !text.trim() : !pdfBase64)}
          >
            {loading ? <span className="mi-spinner" /> : 'Extraer datos →'}
          </button>
        </form>
      )}

      {proposed !== null && proposed.length === 0 && (
        <div className="mi-ingest-empty">
          <div className="mi-ingest-empty-icon">∅</div>
          <div className="mi-ingest-empty-title">Sin datos extraíbles</div>
          {sourceDesc && <div className="mi-ingest-empty-source">{sourceDesc}</div>}
          <div className="mi-ingest-empty-msg">{noRowsMsg}</div>
          {notes && <div className="mi-ingest-empty-notes">{notes}</div>}
          <div className="mi-ingest-empty-hint">
            Este documento puede ser una tasación o reporte de propiedad individual. El sistema busca datos de mercado agregados: rentas, disponibilidad, inventario, cap rates (por submercado o a nivel país), tasas de capitalización de encuestas a gestores, o series de tiempo de cap rates por sector.
          </div>
          <button className="mi-export-btn mi-export-btn-ghost" style={{ marginTop: 8 }} onClick={reset}>← Intentar con otro documento</button>
        </div>
      )}

      {proposed !== null && proposed.length > 0 && (
        <div className="mi-review-wrap">
          <div className="mi-review-header">
            <div>
              <div className="mi-review-title">Revisión previa a guardar</div>
              {sourceDesc && <div className="mi-review-source">{sourceDesc}</div>}
              {notes && <div className="mi-review-notes">{notes}</div>}
            </div>
            <div className="mi-review-counts">
              <span className="mi-count-badge mi-badge-insert">{proposed.filter(r => r.action === 'insert').length} nuevos</span>
              <span className="mi-count-badge mi-badge-update">{proposed.filter(r => r.action === 'update').length} actualizaciones</span>
              <span className="mi-count-badge mi-badge-nochange">{proposed.filter(r => r.action === 'no_change').length} sin cambio</span>
              {proposed.some(r => r.action === 'sheet_locked') && (
                <span className="mi-count-badge mi-badge-sheetlock">{proposed.filter(r => r.action === 'sheet_locked').length} en sheet</span>
              )}
              {proposed.some(r => r.possible_duplicate) && (
                <span className="mi-count-badge mi-badge-warning">{proposed.filter(r => r.possible_duplicate).length} posible duplicado{proposed.filter(r => r.possible_duplicate).length !== 1 ? 's' : ''}</span>
              )}
              {proposed.some(r => r.missing_ciudad) && (
                <span className="mi-count-badge mi-badge-warning">{proposed.filter(r => r.missing_ciudad).length} sin ciudad</span>
              )}
            </div>
          </div>

          <div className="mi-select-bar">
            <button className="mi-select-link" onClick={selectAll}>Seleccionar todos</button>
            <button className="mi-select-link" onClick={deselectAll}>Deseleccionar todos</button>
            <span className="mi-select-count">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          </div>

          <div className="mi-proposed-list">
            {proposed.map((item, i) => (
              <ProposedRow key={i} item={item} checked={selected.has(i)} onToggle={() => toggleRow(i)} />
            ))}
          </div>

          {error && <div className="mi-chat-error">{error}</div>}

          <div className="mi-review-actions">
            <button className="mi-chat-submit" onClick={handleConfirm} disabled={commitLoad || selected.size === 0}>
              {commitLoad ? <span className="mi-spinner" /> : `Guardar ${selected.size} registro${selected.size !== 1 ? 's' : ''} →`}
            </button>
            <button className="mi-export-btn mi-export-btn-ghost" onClick={reset}>← Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}
