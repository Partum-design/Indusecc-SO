const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = require('./environment');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Faltan variables de entorno de Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). ' +
    'Configúralas en backend/.env (nunca subas la service role key al repo).'
  );
}

// Cliente con privilegios de servicio: solo se usa en el backend (nunca en el navegador).
// Ignora RLS, por eso toda la autorización por rol se sigue validando en middleware/auth.js.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Cliente con la anon key: se usa únicamente para operaciones de auth que deben
// pasar por las reglas normales de Supabase Auth (login, reset de password, etc).
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = { supabaseAdmin, supabaseAuth };
