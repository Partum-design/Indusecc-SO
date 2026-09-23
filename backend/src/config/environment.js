const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174'];
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const EMAIL_SERVICE = process.env.EMAIL_SERVICE || 'gmail';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutos
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 300;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Acceso rápido por rol (botones de la pantalla de login). Está activo por defecto;
// se apaga en producción real con DEMO_LOGIN_ENABLED=false.
const DEMO_LOGIN_ENABLED = String(process.env.DEMO_LOGIN_ENABLED ?? 'true').toLowerCase() !== 'false';
const DEMO_EMAIL_DOMAIN = (process.env.DEMO_EMAIL_DOMAIN || 'indusecc.com').toLowerCase();

module.exports = {
  PORT,
  NODE_ENV,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  CORS_ORIGIN,
  FRONTEND_URL,
  EMAIL_SERVICE,
  EMAIL_USER,
  EMAIL_PASSWORD,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  LOG_LEVEL,
  DEMO_LOGIN_ENABLED,
  DEMO_EMAIL_DOMAIN,
}
