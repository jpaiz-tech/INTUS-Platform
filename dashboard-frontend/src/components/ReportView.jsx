import { useState, useEffect } from 'react';

const BASE = import.meta.env.VITE_API_BASE || '';

function downloadReport(html, sectorName) {
  const slug = sectorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `etra-${slug}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportView({ sectorName }) {
  const [html,    setHtml]    = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!sectorName) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    setHtml('');

    fetch(`${BASE}/api/report/${encodeURIComponent(sectorName)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(h => { setHtml(h); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [sectorName]);

  if (loading) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: '#6B7280', fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
      Cargando reporte…
    </div>
  );

  if (error) return (
    <div style={{ padding: '32px', color: '#8E3A3A', fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
      Error al cargar reporte: {error}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        padding: '10px 16px', background: '#F4F0E6',
        borderBottom: '1px solid #E0DCD4',
      }}>
        <button
          onClick={() => downloadReport(html, sectorName)}
          style={{
            fontFamily: 'Verdana, sans-serif', fontSize: 11, fontWeight: 700,
            color: '#0D1F33', background: 'transparent',
            border: '1.5px solid #0D1F33', borderRadius: 2,
            padding: '5px 14px', cursor: 'pointer', letterSpacing: '0.5px',
          }}
        >
          ↓ Descargar HTML
        </button>
      </div>
      <iframe
        srcDoc={html}
        title={`Reporte — ${sectorName}`}
        style={{ width: '100%', height: '900px', border: 'none', display: 'block' }}
        sandbox="allow-same-origin"
      />
    </div>
  );
}
