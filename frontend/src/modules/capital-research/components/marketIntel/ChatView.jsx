import { useState, useRef, useEffect } from 'react';
import ResponseCard from './ResponseCard.jsx';

const BASE = import.meta.env.VITE_API_BASE || '';

const SUGGESTIONS = [
  'Rentas de oficinas en Panamá por subzona',
  'Comparar disponibilidad Costa Rica vs. Panamá en oficinas',
  'Ranking de mercados industriales por ocupación',
  'Retail en Panamá — qué datos hay disponibles?',
  '¿Cuáles mercados tienen señales de alerta (vacancia subiendo)?',
];

export default function ChatView() {
  const [messages, setMessages] = useState([]); // [{role, query, response, error}]
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Build compact history for backend (just labels + values, not full row data)
  function buildHistory() {
    return messages
      .filter(m => m.response)
      .slice(-3) // last 3 exchanges max
      .map(m => ({
        query:          m.query,
        interpreted_as: m.response.intent?.interpreted_as || m.query,
        filters_used:   m.response.intent?.filters || {},
        summary:        m.response.response?.summary || '',
        metric_labels:  (m.response.response?.metric_cards || [])
                          .filter(c => !c.missing)
                          .map(c => `${c.label}: ${c.value} ${c.unit}`)
                          .slice(0, 8),
      }));
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    setLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', query: q }]);

    try {
      const res  = await fetch(`${BASE}/api/market-data/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: q, history: buildHistory() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'user', query: q, response: data };
        return copy;
      });
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'user', query: q, error: err.message };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function useSuggestion(s) {
    setInput(s);
  }

  function handleClear() {
    setMessages([]);
    setInput('');
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col gap-4">

      {/* Thread */}
      {hasMessages && (
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-slate-700 self-end max-w-[85%]">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mr-2">Consulta</span>
                <span>{msg.query}</span>
              </div>
              {msg.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 p-3"><strong>Error:</strong> {msg.error}</div>
              )}
              {msg.response && (
                <ResponseCard response={msg.response} query={msg.query} />
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
              <span>Consultando base de datos y generando análisis…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Suggestions — only before first message */}
      {!hasMessages && !loading && (
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Sugerencias</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-3 py-2 hover:border-emerald-300 hover:text-emerald-600 transition-all"
                onClick={() => useSuggestion(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input — always visible */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        {hasMessages && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-3">
            <span>Puedes continuar: </span>
            <button className="border border-slate-200 text-slate-500 rounded-full text-xs px-3 py-1 hover:border-emerald-300 hover:text-emerald-600 transition-all" onClick={() => setInput('Agrega datos de retail a este análisis')}>+ agregar retail</button>
            <button className="border border-slate-200 text-slate-500 rounded-full text-xs px-3 py-1 hover:border-emerald-300 hover:text-emerald-600 transition-all" onClick={() => setInput('Filtra solo las subzonas con disponibilidad menor a 15%')}>filtrar por disponibilidad</button>
            <button className="border border-slate-200 text-slate-500 rounded-full text-xs px-3 py-1 hover:border-emerald-300 hover:text-emerald-600 transition-all" onClick={() => setInput('Genera un reporte completo con estos datos')}>generar reporte</button>
            <button className="border border-slate-200 text-slate-400 rounded-full text-xs px-3 py-1 hover:border-red-300 hover:text-red-500 transition-all" onClick={handleClear}>✕ nueva consulta</button>
          </div>
        )}
        <form className="flex gap-2 items-end" onSubmit={handleSubmit}>
          <textarea
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 resize-none"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={hasMessages
              ? 'Continúa la conversación: agrega datos, filtra, cambia enfoque…'
              : '¿Qué quieres saber del mercado? ej. rentas de oficinas en Panamá, cap rates, ranking por ocupación…'}
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          />
          <button
            type="submit"
            className="bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2.5 hover:bg-emerald-600 transition-all disabled:opacity-50 whitespace-nowrap"
            disabled={loading || !input.trim()}
          >
            {loading ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Consultar →'}
          </button>
        </form>
      </div>
    </div>
  );
}
