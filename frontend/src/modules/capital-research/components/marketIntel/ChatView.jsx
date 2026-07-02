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
    <div className="mi-chat-wrap">

      {/* Thread */}
      {hasMessages && (
        <div className="mi-thread">
          {messages.map((msg, i) => (
            <div key={i} className="mi-thread-item">
              <div className="mi-thread-query">
                <span className="mi-thread-q-label">Consulta</span>
                <span className="mi-thread-q-text">{msg.query}</span>
              </div>
              {msg.error && (
                <div className="mi-chat-error"><strong>Error:</strong> {msg.error}</div>
              )}
              {msg.response && (
                <ResponseCard response={msg.response} query={msg.query} />
              )}
            </div>
          ))}

          {loading && (
            <div className="mi-loading">
              <span className="mi-spinner-lg" />
              <span>Consultando base de datos y generando análisis…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Suggestions — only before first message */}
      {!hasMessages && !loading && (
        <div className="mi-suggestions">
          <div className="mi-suggestions-label">Sugerencias</div>
          <div className="mi-suggestions-list">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="mi-suggestion-chip" onClick={() => useSuggestion(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input — always visible */}
      <div className={`mi-chat-form-wrap${hasMessages ? ' mi-chat-form-wrap--thread' : ''}`}>
        {hasMessages && (
          <div className="mi-chat-followup-hints">
            <span>Puedes continuar: </span>
            <button className="mi-hint-chip" onClick={() => setInput('Agrega datos de retail a este análisis')}>+ agregar retail</button>
            <button className="mi-hint-chip" onClick={() => setInput('Filtra solo las subzonas con disponibilidad menor a 15%')}>filtrar por disponibilidad</button>
            <button className="mi-hint-chip" onClick={() => setInput('Genera un reporte completo con estos datos')}>generar reporte</button>
            <button className="mi-hint-chip mi-hint-clear" onClick={handleClear}>✕ nueva consulta</button>
          </div>
        )}
        <form className="mi-chat-form" onSubmit={handleSubmit}>
          <textarea
            className="mi-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={hasMessages
              ? 'Continúa la conversación: agrega datos, filtra, cambia enfoque…'
              : '¿Qué quieres saber del mercado? ej. rentas de oficinas en Panamá, cap rates, ranking por ocupación…'}
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          />
          <button type="submit" className="mi-chat-submit" disabled={loading || !input.trim()}>
            {loading ? <span className="mi-spinner" /> : 'Consultar →'}
          </button>
        </form>
      </div>
    </div>
  );
}
