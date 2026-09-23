// Acceso rápido por rol (botones del login).
//
// Cada rol tiene una cuenta propia (demo-<rol>@<dominio>) que se crea sola la primera vez
// que alguien pulsa el botón. La contraseña NO está en el código ni en el frontend: se deriva
// con HMAC-SHA256 de la service role key, así que solo el servidor puede iniciar sesión con
// ellas y cambia sola si la llave se rota.

const crypto = require('crypto');
const { supabaseAdmin, supabaseAuth } = require('../config/supabaseClient');
const { SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL_DOMAIN } = require('../config/environment');
const logger = require('../utils/logger');

const DEMO_ROLES = {
  SUPER_ADMIN: { slug: 'superadmin', dbRole: 'super_admin', name: 'Super Admin Demo', department: 'Dirección General' },
  ADMIN: { slug: 'admin', dbRole: 'admin', name: 'Administrador Demo', department: 'Gestión de Calidad' },
  COLABORADOR: { slug: 'colaborador', dbRole: 'colaborador', name: 'Colaborador Demo', department: 'Producción' },
  CONSULTOR: { slug: 'consultor', dbRole: 'consultor', name: 'Consultor Demo', department: 'Auditoría externa' },
};

const demoEmail = (cfg) => `demo-${cfg.slug}@${DEMO_EMAIL_DOMAIN}`;

const demoPassword = (email) =>
  `${crypto.createHmac('sha256', SUPABASE_SERVICE_ROLE_KEY).update(`demo-login:${email}`).digest('base64url').slice(0, 32)}aA1!`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const findProfile = async (email) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, role, active')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const ensureDemoUser = async (roleKey) => {
  const cfg = DEMO_ROLES[roleKey];
  const email = demoEmail(cfg);
  const password = demoPassword(email);

  let profile = await findProfile(email);

  if (!profile) {
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: cfg.name, department: cfg.department, requested_role: 'colaborador' },
    });

    // Si otra instancia lo creó al mismo tiempo, basta con esperar a que exista el perfil.
    if (createError && !/already|exists|registered/i.test(createError.message || '')) {
      throw createError;
    }

    for (let attempt = 0; attempt < 5 && !profile; attempt += 1) {
      profile = await findProfile(email);
      if (!profile) await sleep(150);
    }
    if (!profile) throw new Error('No se pudo crear el perfil de la cuenta de demostración');
  }

  // El trigger de registro crea el perfil como colaborador inactivo: aquí se fija el rol real.
  if (profile.role !== cfg.dbRole || !profile.active || profile.name !== cfg.name) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: cfg.dbRole, active: true, name: cfg.name, department: cfg.department })
      .eq('id', profile.id);
    if (error) throw error;

    // Que la cuenta demo no aparezca como solicitud de acceso pendiente.
    await supabaseAdmin
      .from('registration_requests')
      .update({ status: 'aprobada', approved_at: new Date().toISOString(), approval_notes: 'Cuenta de demostración' })
      .eq('user_id', profile.id)
      .eq('status', 'pendiente');
  }

  return { id: profile.id, email, password, cfg };
};

const signIn = async (email, password) =>
  supabaseAuth.auth.signInWithPassword({ email, password });

const demoLogin = async (roleKey) => {
  if (!DEMO_ROLES[roleKey]) {
    const error = new Error('Rol de demostración inválido');
    error.status = 400;
    throw error;
  }

  const { id, email, password, cfg } = await ensureDemoUser(roleKey);

  let { data, error } = await signIn(email, password);

  if (error || !data?.session) {
    // La contraseña derivada cambió (rotación de llaves): se resincroniza y se reintenta una vez.
    logger.warn(`Resincronizando contraseña de la cuenta demo ${email}`);
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
    if (updateError) throw updateError;
    ({ data, error } = await signIn(email, password));
  }

  if (error || !data?.session) throw error || new Error('No se pudo iniciar sesión');

  await supabaseAdmin.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', id);

  return {
    user: { id, name: cfg.name, email, role: roleKey },
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
};

module.exports = { DEMO_ROLES, demoLogin };
