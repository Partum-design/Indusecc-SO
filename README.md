# Indusecc SO — Sistema de Gestión de Calidad (ISO 9001:2015)

Plataforma web para gestionar un SGC con cuatro roles (`Super Admin`, `Admin`, `Colaborador`, `Consultor`):
documentos por cláusula de la norma, firmas electrónicas, notificaciones, auditorías, hallazgos, riesgos, tareas y calendario.

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Vite + React Router + Axios |
| Backend | Node.js + Express 5 (en Vercel corre como función serverless: `api/index.js`) |
| Datos | Supabase: Postgres (RLS), Auth y Storage |
| Hosting | Vercel (frontend estático + `/api/*`) |

## Qué hace

- **Acceso por rol con un clic** en la pantalla de login (cuentas de demostración, ver [Acceso rápido](#acceso-rápido-por-rol)).
- **Norma ISO 9001:2015 completa** (cláusulas 4 a 10, 91 puntos hasta el nivel x.y.z.w) en la tabla `iso_clauses`.
- **Documentos**: subida directa a Supabase Storage (hasta 25 MB; PDF, Word, Excel, PowerPoint, imágenes, TXT, CSV),
  clasificación por cláusula, vista previa, descarga, edición y baja. Cada archivo guarda su huella SHA-256.
- **Cumplimiento automático**: se recalcula solo con cada documento y firma, sin capturar nada a mano:
  - cláusula sin documentos → **0 %**
  - documento cargado (vigente o en revisión) → **50 %**
  - documento **vigente y firmado** → **100 %**
  - un documento en una cláusula “padre” (p. ej. 7.1) respalda a todas sus subcláusulas; los vencidos y archivados no cuentan.
- **Firma electrónica**: firma dibujada o escrita, declaración aceptada, IP, fecha y huella. Una firma emitida es **inmutable**
  (trigger en la base) y queda ligada al contenido exacto del archivo (si el archivo cambia, ya no se puede firmar y
  “Verificar integridad” lo detecta). Se pueden **solicitar firmas**, **reenviar recordatorios** y cancelar solicitudes.
  Un documento en revisión pasa a vigente cuando firman todos los solicitados.
- **Notificaciones reales** (campana con contador, centro de notificaciones, avisos manuales, reenvío) por documento subido,
  firma solicitada/emitida, tarea/auditoría/evento asignados, hallazgos y solicitudes de acceso. Si hay SMTP configurado
  también salen por correo.
- **Renovación automática de sesión** (los tokens de Supabase duran 1 h).

## Estructura

```text
api/index.js              punto de entrada serverless de Vercel (reexporta backend/src/server.js)
backend/                  API Express (controllers, routes, services, utils, tests, scripts)
frontend/                 SPA React
supabase/migrations/      esquema SQL (aplicar en orden)
vercel.json               build y rewrites
```

## Base de datos: migraciones

Se aplican **en orden** (la segunda depende de la primera). Ambas son seguras de ejecutar más de una vez (la segunda es idempotente).

1. `supabase/migrations/20260703000000_init_schema.sql` — esquema base, roles, RLS, buckets.
   ⚠️ Empieza con `drop table ... profiles cascade`: solo para proyectos nuevos o dedicados a esta app.
2. `supabase/migrations/20260923000000_iso_documents_signatures_notifications.sql` — catálogo ISO, firmas, notificaciones,
   columnas `version`/`sha256`, estado `en_revision` y tipos de archivo del bucket.

Dos formas de aplicarlas: pegar el archivo en **Supabase → SQL Editor**, o con la CLI (`supabase link` + `supabase db push`).

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Sí | Conexión a Supabase. La service role **nunca** va al frontend. |
| `FRONTEND_URL` | Recomendada | URL pública (p. ej. `https://tu-app.vercel.app`) para los enlaces de correos. |
| `DEMO_LOGIN_ENABLED` | No (por defecto `true`) | `false` apaga los botones de acceso rápido. |
| `DEMO_EMAIL_DOMAIN` | No (`indusecc.com`) | Dominio de las cuentas `demo-<rol>@dominio`. |
| `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_SERVICE` | No | SMTP (Gmail con contraseña de aplicación) para enviar notificaciones por correo. Sin esto las notificaciones siguen funcionando dentro de la plataforma. |
| `RATE_LIMIT_MAX_REQUESTS` | No (300) | Solicitudes por sesión cada 15 min. |
| `CORS_ORIGIN` | No | Orígenes extra permitidos (los `*.vercel.app` y localhost ya lo están). |

## Acceso rápido por rol

El login muestra un botón por rol. Cada rol usa su propia cuenta (`demo-superadmin@…`, `demo-admin@…`, …) que se crea sola
la primera vez. La contraseña **no está en el código**: se deriva con HMAC de la service role key, así que solo el servidor
puede iniciar sesión con ellas. Estas cuentas pueden usar toda la operación del SGC pero **no** crear usuarios, aprobar
solicitudes, cambiar roles/contraseñas, restaurar configuración ni purgar logs (`DEMO_ACCOUNT_RESTRICTED`).
Para producción con usuarios reales, pon `DEMO_LOGIN_ENABLED=false`.

El rol **Consultor** es de solo lectura: consulta, descarga y firma, pero no sube documentos.

## Desarrollo local

```bash
# 1) Supabase local (Docker) con las migraciones del repo
npx supabase start          # aplica supabase/migrations automáticamente

# 2) Backend  (backend/.env a partir de backend/.env.example, con las llaves que imprime `supabase start`)
cd backend && npm install && npm run dev

# 3) Frontend
cd frontend && npm install
echo "VITE_API_URL=http://127.0.0.1:3000/api/" > .env     # o el puerto que uses
npm run dev
```

### Pruebas

```bash
cd backend
npm test                    # unitarias (cálculo de cumplimiento, firmas, auth)
npm run e2e:local           # extremo a extremo contra Supabase LOCAL (se niega a correr contra otra URL)
cd ../frontend && npm run lint && npm run build
```

`e2e:local` recorre login por rol, subida directa a Storage, clasificación ISO, firmas, recordatorios, integridad,
permisos, notificaciones y tareas (más de 120 comprobaciones).

## Despliegue

`vercel.json` construye el frontend (`frontend/dist`) e instala las dependencias del backend; `/api/*` se reescribe a la función
`api/index.js`. Orden recomendado: **1)** aplicar las migraciones en Supabase, **2)** revisar las variables de entorno,
**3)** hacer push a `main`.
