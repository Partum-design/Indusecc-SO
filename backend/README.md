# Backend — Indusecc SO

API REST en Node.js + Express 5 sobre **Supabase** (Postgres, Auth y Storage). En producción corre como función serverless de Vercel
(`../api/index.js` reexporta `src/server.js`).

## Arranque

```bash
cp .env.example .env     # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY ...
npm install
npm run dev              # http://127.0.0.1:3000/api/health
```

## Estructura

```text
src/
  config/        variables de entorno y clientes de Supabase (service role y anon)
  middleware/    authenticate / authorize / blockDemo, validaciones
  controllers/   lógica por módulo (documentos, firmas, notificaciones, normas, métricas...)
  routes/        rutas Express (/api/*)
  services/      isoService (datos ISO), notificationService, demoAccess
  utils/         isoStats (cálculo puro de cumplimiento), signature (SHA-256), roleLinks, email, logger
tests/           Jest (unitarias)
scripts/         dbCheck.js, e2eLocal.js (extremo a extremo contra Supabase local)
```

## Seguridad y autorización

- Toda ruta (salvo login, registro, recuperación, `demo-*` y `/public/stats`) exige `Authorization: Bearer <token de Supabase>`.
  El middleware valida el token, carga el perfil y rechaza usuarios inactivos.
- El backend usa la **service role key** (ignora RLS), por eso **la autorización se aplica en los controladores**:
  - Documentos: subir → todos menos Consultor; editar/eliminar/pedir firmas → autor o admin; firmar/ver → cualquier usuario activo.
  - Acciones/tareas: crear y eliminar → admin; el asignado solo cambia el estado de la suya.
  - Notificaciones: cada usuario solo ve/lee/borra las suyas; reenviar → quien la envió o un admin.
- Cuentas demo (`demo-<rol>@…`): bloqueadas en creación/edición de usuarios, roles, contraseñas, configuración y logs (`blockDemo`).
- Rate limiting: por sesión (300/15 min por defecto) más un respaldo por IP; el login tiene su propio límite.

## Endpoints principales

| Módulo | Rutas |
|--------|-------|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `GET /auth/demo-status` · `POST /auth/demo-login` |
| Público | `GET /public/stats` (solo agregados, para el login) |
| Documentos | `GET /documents` · `GET /documents/stats` · `POST /documents/upload-url` → subida directa → `POST /documents` · `GET /documents/:id/url` · `PUT/DELETE /documents/:id` · `GET /documents/:id/verify` |
| Firmas | `GET /documents/:id/signatures` · `POST /documents/:id/signatures/request` · `POST /documents/:id/signatures/:sigId/resend` · `DELETE …/:sigId` · `POST /documents/:id/sign` |
| ISO | `GET /norms/tree` · `GET /norms/compliance-report` · `GET /norms/clauses/:code` · `GET /norms/clauses/:code/export` (`all` para toda la norma) |
| Notificaciones | `GET /notifications` · `GET /notifications/sent` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` · `DELETE /notifications/:id` · `DELETE /notifications/read` · `POST /notifications/:id/resend` · `POST /notifications/send` |
| Otros | usuarios, roles, auditorías, hallazgos, riesgos, acciones, calendario, capacitaciones, métricas, administración |

### Subida de archivos

Vercel limita el cuerpo de una función a 4.5 MB, así que el archivo **no pasa por la API**:
`POST /documents/upload-url` devuelve una URL firmada de Supabase Storage, el navegador sube directo y luego
`POST /documents` registra el documento (el backend descarga el objeto, valida ruta/tipo/cláusula y calcula el SHA-256).
El visor pide `GET /documents/:id/url` (URL firmada de 2 min) en lugar de recibir el archivo por la función.

## Pruebas

```bash
npm test             # Jest: cálculo de cumplimiento ISO, firmas, autenticación
npm run e2e:local    # requiere `supabase start` (URL local); crea cuentas demo y datos de prueba
```
