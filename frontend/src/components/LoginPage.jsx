import { useState } from 'react';
import { useAuth, ALLOWED_DOMAIN } from '../lib/AuthContext.jsx';
import { IntusLogo } from '../legacy/ui.jsx';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

export default function LoginPage() {
  const { signInGoogle, signInPassword, authError, setAuthError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await signInPassword(email, password);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <IntusLogo size={36} />
          <div className="text-xs font-medium text-emerald-500 tracking-wide mt-2">Platform</div>
        </div>

        {authError && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {authError}
          </div>
        )}

        <button
          onClick={() => { setAuthError(null); signInGoogle(); }}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:shadow-sm transition-all"
        >
          <GoogleG />
          Continuar con Google
        </button>

        <div className="text-center text-[11px] text-slate-400 mt-3">
          Solo cuentas <span className="font-semibold text-slate-500">@{ALLOWED_DOMAIN}</span>
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] text-slate-300 uppercase tracking-wider">o</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {!showPassword ? (
          <button
            onClick={() => setShowPassword(true)}
            className="w-full text-center text-xs text-slate-400 hover:text-emerald-600 transition-colors"
          >
            Ingresar con correo y contraseña
          </button>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              required
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              required
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
