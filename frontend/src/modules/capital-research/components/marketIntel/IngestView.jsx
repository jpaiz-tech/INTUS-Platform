import { useState, useRef, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_BASE || '';

function ActionBadge({ action }) {
  const map = {
    insert:       ['INSERT',       'bg-emerald-50 text-emerald-700'],
    update:       ['UPDATE',       'bg-amber-50 text-amber-700'],
    no_change:    ['SIN CAMBIOS',  'bg-slate-100 text-slate-500'],
    sheet_locked: ['EN SHEET',     'bg-indigo-50 text-indigo-600'],
  };
  const [label, cls] = map[action] || ['?', 'bg-slate-100 text-slate-500'];
  return <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

function ChangesList({ changes }) {
  if (!changes || Object.keys(changes).length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(changes).map(([field, { old: o, new: n }]) => (
        <div key={field} className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium w-32 shrink-0">{field}</span>
          <span className="font-mono text-red-500 line-through">{o ?? '—'}</span>
          <span className="text-slate-300">→</span>
          <span className="font-mono text-emerald-600 font-semibold">{n ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function HistoryView() {
  const [items,   setItems]   = useState(null); // null = loading
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/market-data/history`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setItems(d.ingestions || []); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3">{error}</div>;
  if (!items) return <div className="text-sm text-slate-400 p-4">Cargando historial…</div>;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center flex flex-col items-center gap-2">
        <div className="text-3xl text-slate-300">∅</div>
        <div className="text-base font-bold text-slate-700">Sin cargas todavía</div>
        <div className="text-sm text-slate-500">Los documentos y textos que subas aparecerán aquí.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${item.source_type === 'pdf' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
              {item.source_type === 'pdf' ? 'PDF' : 'TEXTO'}
            </span>
            <span className="text-sm font-semibold text-slate-700 truncate">
              {item.file_name || item.source_description || 'Documento sin nombre'}
            </span>
            <span className="text-xs text-slate-400 ml-auto shrink-0">{timeAgo(item.created_at)}</span>
          </div>
          {item.source_description && item.file_name && (
            <div className="text-xs text-slate-500">{item.source_description}</div>
          )}
          <div className="flex items-center gap-3 text-xs">
            {item.rows_inserted > 0 && <span className="text-emerald-600 font-semibold">{item.rows_inserted} nuevo{item.rows_inserted !== 1 ? 's' : ''}</span>}
            {item.rows_updated > 0 && <span className="text-amber-600 font-semibold">{item.rows_updated} actualizado{item.rows_updated !== 1 ? 's' : ''}</span>}
            {item.rows_inserted === 0 && item.rows_updated === 0 && <span className="text-slate-400">Sin cambios guardados</span>}
          </div>
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

  const borderCls = missing_ciudad
    ? 'border-red-200'
    : possible_duplicate
      ? 'border-amber-300'
      : isSheetLocked
        ? 'border-indigo-200'
        : 'border-slate-200';

  return (
    <div className={`bg-white rounded-xl border ${borderCls} ${isReadOnly ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {!isReadOnly && (
          <input type="checkbox" className="w-4 h-4 accent-emerald-500" checked={checked} onChange={onToggle} />
        )}
        <ActionBadge action={action} />
        {possible_duplicate && <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-red-50 text-red-600">POSIBLE DUPLICADO</span>}
        {missing_ciudad && <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-red-50 text-red-600">SIN CIUDAD</span>}
        <span className="text-xs text-slate-600 flex-1 truncate">
          {[row.pais, row.ciudad, row.subzona].filter(Boolean).join(' › ')}
          {' — '}<strong>{row.sector}</strong>
          {row.periodo && <span className="text-slate-400"> · {row.periodo}</span>}
        </span>
        <button className="text-slate-400 hover:text-emerald-600 text-xs px-1 transition-colors" onClick={() => setExpanded(o => !o)}>
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-3 flex flex-col gap-3 bg-slate-50/50">
          {missing_ciudad && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              Este registro no tiene ciudad especificada (dato a nivel país). Verifica si el documento
              menciona una ciudad y agrégala manualmente antes de guardar, o confirma que es correcto
              dejarlo a nivel país.
            </div>
          )}
          {isSheetLocked && (
            <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
              Este registro existe en Google Sheets. Para actualizarlo, edítalo directamente en la hoja y sincroniza.
              {changes && Object.keys(changes).length > 0 && ' El PDF tiene valores distintos — ve los detalles abajo.'}
            </div>
          )}
          {possible_duplicate && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Ya existe un registro muy similar para este submercado/período
              {similar_existing?.referencia && <> de <strong>{similar_existing.referencia}</strong></>}
              {' '}({matched_fields?.length || 0} valor{matched_fields?.length !== 1 ? 'es' : ''} coincidente{matched_fields?.length !== 1 ? 's' : ''}: {matched_fields?.join(', ')}).
              Verifica que no sea el mismo reporte extraído dos veces antes de guardar.
            </div>
          )}
          {(action === 'update' || isSheetLocked) && changes && Object.keys(changes).length > 0 && (
            <>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isSheetLocked ? 'Diferencias (solo lectura)' : 'Cambios propuestos'}</div>
              <ChangesList changes={changes} />
            </>
          )}
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Datos extraídos</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(row).filter(([, v]) => v != null).map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase">{k}</span>
                <span className="text-xs text-slate-700 font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
          {row.info_resumen && (
            <div className="text-xs text-slate-500 italic">
              <span className="text-[10px] text-slate-400 uppercase not-italic">Notas:</span> {row.info_resumen}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IngestView() {
  const [mode,        setMode]        = useState('text');  // 'text' | 'pdf' | 'history'
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
        body:    JSON.stringify({
          confirmed_rows,
          source_type:        mode === 'pdf' ? 'pdf' : 'pasted_text',
          file_name:          pdfFile?.name || null,
          source_description: sourceDesc,
          extraction_notes:   notes,
        }),
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
      <div>
        <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-8 text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl">✓</div>
          <div className="text-base font-bold text-slate-800">Datos guardados</div>
          <div className="text-sm text-slate-500">
            {inserted > 0 && <span>{inserted} registro{inserted !== 1 ? 's' : ''} nuevo{inserted !== 1 ? 's' : ''}</span>}
            {inserted > 0 && updated > 0 && ' · '}
            {updated  > 0 && <span>{updated} actualizado{updated !== 1 ? 's' : ''}</span>}
          </div>
          <button className="bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 hover:bg-emerald-600 transition-all mt-3" onClick={reset}>+ Cargar más datos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!proposed && (
        <div className="bg-slate-50 rounded-xl p-1 border border-slate-200 flex gap-1 w-fit">
          <button type="button" className={mode === 'text' ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 transition-all' : 'text-slate-400 hover:bg-white rounded-lg text-xs font-semibold px-4 py-2 transition-all'} onClick={() => setMode('text')}>
            Pegar texto
          </button>
          <button type="button" className={mode === 'pdf' ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 transition-all' : 'text-slate-400 hover:bg-white rounded-lg text-xs font-semibold px-4 py-2 transition-all'} onClick={() => setMode('pdf')}>
            Subir PDF
          </button>
          <button type="button" className={mode === 'history' ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 transition-all' : 'text-slate-400 hover:bg-white rounded-lg text-xs font-semibold px-4 py-2 transition-all'} onClick={() => setMode('history')}>
            Historial
          </button>
        </div>
      )}

      {!proposed && mode === 'history' && <HistoryView />}

      {!proposed && mode !== 'history' && (
        <form className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4" onSubmit={handleExtract}>
          {mode === 'text' && (
            <textarea
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 resize-y"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Pega aquí el texto del reporte de mercado (CBRE, JLL, Colliers, Logan, etc.) o de encuestas a gestores. El sistema extraerá rentas, ocupación, cap rates, series de tiempo y más de forma estructurada."
              rows={10}
            />
          )}

          {mode === 'pdf' && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-300 transition-all" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
              {pdfFile ? (
                <div className="flex items-center gap-2 justify-center">
                  <span className="text-xl">📄</span>
                  <span className="text-sm text-slate-700 font-medium">{pdfFile.name}</span>
                  <button type="button" className="text-slate-400 hover:text-red-500 text-sm ml-2 transition-colors" onClick={e => { e.stopPropagation(); setPdfFile(null); setPdfBase64(null); }}>✕</button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="text-3xl text-slate-300">↑</div>
                  <div>Haz clic para seleccionar un PDF</div>
                  <div className="text-xs text-slate-400">Reportes de mercado, market snapshots, estudios de broker</div>
                </div>
              )}
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3">{error}</div>}

          <button
            type="submit"
            className="bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 hover:bg-emerald-600 transition-all disabled:opacity-50 w-fit"
            disabled={loading || (mode === 'text' ? !text.trim() : !pdfBase64)}
          >
            {loading ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Extraer datos →'}
          </button>
        </form>
      )}

      {proposed !== null && proposed.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center flex flex-col items-center gap-2">
          <div className="text-3xl text-slate-300">∅</div>
          <div className="text-base font-bold text-slate-700">Sin datos extraíbles</div>
          {sourceDesc && <div className="text-sm text-slate-500">{sourceDesc}</div>}
          <div className="text-sm text-slate-500">{noRowsMsg}</div>
          {notes && <div className="text-xs text-slate-400">{notes}</div>}
          <div className="text-xs text-slate-400 max-w-md">
            Este documento puede ser una tasación o reporte de propiedad individual. El sistema busca datos de mercado agregados: rentas, disponibilidad, inventario, cap rates (por submercado o a nivel país), tasas de capitalización de encuestas a gestores, o series de tiempo de cap rates por sector.
          </div>
          <button className="border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-4 py-2 hover:border-emerald-300 hover:text-emerald-600 transition-all mt-2" onClick={reset}>← Intentar con otro documento</button>
        </div>
      )}

      {proposed !== null && proposed.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-base font-bold text-slate-800">Revisión previa a guardar</div>
              {sourceDesc && <div className="text-xs text-slate-400">{sourceDesc}</div>}
              {notes && <div className="text-xs text-slate-400 mt-1">{notes}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700">{proposed.filter(r => r.action === 'insert').length} nuevos</span>
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-50 text-amber-700">{proposed.filter(r => r.action === 'update').length} actualizaciones</span>
              <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-slate-100 text-slate-500">{proposed.filter(r => r.action === 'no_change').length} sin cambio</span>
              {proposed.some(r => r.action === 'sheet_locked') && (
                <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-indigo-50 text-indigo-600">{proposed.filter(r => r.action === 'sheet_locked').length} en sheet</span>
              )}
              {proposed.some(r => r.possible_duplicate) && (
                <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-red-50 text-red-600">{proposed.filter(r => r.possible_duplicate).length} posible duplicado{proposed.filter(r => r.possible_duplicate).length !== 1 ? 's' : ''}</span>
              )}
              {proposed.some(r => r.missing_ciudad) && (
                <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-red-50 text-red-600">{proposed.filter(r => r.missing_ciudad).length} sin ciudad</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button className="text-emerald-600 font-semibold hover:underline" onClick={selectAll}>Seleccionar todos</button>
            <button className="text-emerald-600 font-semibold hover:underline" onClick={deselectAll}>Deseleccionar todos</button>
            <span className="text-slate-400 ml-auto">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex flex-col gap-2">
            {proposed.map((item, i) => (
              <ProposedRow key={i} item={item} checked={selected.has(i)} onToggle={() => toggleRow(i)} />
            ))}
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3">{error}</div>}

          <div className="flex gap-3">
            <button className="bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 hover:bg-emerald-600 transition-all disabled:opacity-50" onClick={handleConfirm} disabled={commitLoad || selected.size === 0}>
              {commitLoad ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : `Guardar ${selected.size} registro${selected.size !== 1 ? 's' : ''} →`}
            </button>
            <button className="border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-4 py-2 hover:border-emerald-300 hover:text-emerald-600 transition-all" onClick={reset}>← Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}
