import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F0E6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', border: '1px solid rgba(13,31,51,.18)',
        borderRadius: 3, padding: '48px 44px', width: '100%', maxWidth: 400,
        boxShadow: '0 2px 12px rgba(13,31,51,.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Verdana,sans-serif', fontSize: 11, fontWeight: 700,
            letterSpacing: 3, textTransform: 'uppercase', color: '#A88B4F',
            marginBottom: 6,
          }}>
            ETRA Legacy Fund
          </div>
          <div style={{
            fontFamily: 'Verdana,sans-serif', fontSize: 22, fontWeight: 700,
            color: '#0D1F33', letterSpacing: 1,
          }}>
            INTUS<span style={{ fontWeight: 300 }}> CAPITAL</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontFamily: 'Verdana,sans-serif', fontSize: 11,
              fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              color: '#3A4E5E', marginBottom: 6,
            }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid rgba(13,31,51,.25)', borderRadius: 2,
                fontFamily: 'Verdana,sans-serif', fontSize: 14, color: '#0D1F33',
                background: '#FAFAF8', outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontFamily: 'Verdana,sans-serif', fontSize: 11,
              fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              color: '#3A4E5E', marginBottom: 6,
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid rgba(13,31,51,.25)', borderRadius: 2,
                fontFamily: 'Verdana,sans-serif', fontSize: 14, color: '#0D1F33',
                background: '#FAFAF8', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 12px',
              background: 'rgba(142,58,58,.07)', border: '1px solid rgba(142,58,58,.25)',
              borderRadius: 2, fontFamily: 'Verdana,sans-serif', fontSize: 13,
              color: '#8E3A3A',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px 0',
              background: loading ? '#8fa8bf' : '#0D1F33',
              color: '#F4F0E6', border: 'none', borderRadius: 2,
              fontFamily: 'Verdana,sans-serif', fontSize: 13, fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
