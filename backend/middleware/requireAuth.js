import supabase from '../utils/supabaseClient.js';

// Optional API auth: validates the Supabase access token sent by the frontend
// (Authorization: Bearer <token>) and restricts to @intuscorp.com accounts.
// OFF by default so local dev keeps working; enable with REQUIRE_AUTH=true
// (e.g. in Railway for production).
const ALLOWED_DOMAIN = 'intuscorp.com';

export async function requireAuth(req, res, next) {
  if (process.env.REQUIRE_AUTH !== 'true') return next();
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/status') return next(); // harmless mode info, needed pre-render

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'No autorizado: falta token de sesión' });
  if (!supabase) return res.status(503).json({ error: 'Auth activada pero Supabase no está configurado en el servidor' });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    const email = data?.user?.email?.toLowerCase();
    if (error || !email) return res.status(401).json({ error: 'Token inválido o expirado' });
    if (!email.endsWith('@' + ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: `Acceso restringido a cuentas @${ALLOWED_DOMAIN}` });
    }
    req.user = data.user;
    return next();
  } catch {
    return res.status(401).json({ error: 'No se pudo validar el token' });
  }
}
