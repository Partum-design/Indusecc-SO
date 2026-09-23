// Prueba de extremo a extremo contra un Supabase LOCAL (supabase start).
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/e2eLocal.js
//
// Crea cuentas demo, sube archivos, firma, notifica... por eso se NIEGA a correr si la URL
// no es local: jamás debe ejecutarse contra el proyecto de producción.

process.env.NODE_ENV = 'test';
process.env.DEMO_LOGIN_ENABLED = process.env.DEMO_LOGIN_ENABLED || 'true';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL)) {
  console.error('Abortado: SUPABASE_URL debe apuntar a un Supabase local (127.0.0.1 / localhost).');
  process.exit(2);
}

const assert = require('assert');
const app = require('../src/server');
const { supabaseAdmin } = require('../src/config/supabaseClient');

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let failures = 0;
let passed = 0;
const check = (name, condition, extra = '') => {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✘ ${name} ${extra ? `→ ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
  }
};

const section = (title) => console.log(`\n${title}`);

// Deja la base LOCAL sin datos de negocio para que la prueba sea repetible.
// (Seguro: el script ya abortó arriba si SUPABASE_URL no es local.)
const resetLocalData = async () => {
  const { data: objects } = await supabaseAdmin.from('documents').select('storage_path');
  if (objects?.length) await supabaseAdmin.storage.from('documents').remove(objects.map(o => o.storage_path));
  const nil = '00000000-0000-0000-0000-000000000000';
  for (const table of ['document_signatures', 'documents', 'notifications', 'actions', 'findings', 'audits', 'calendar_events']) {
    const { error } = await supabaseAdmin.from(table).delete().neq('id', nil);
    if (error) throw new Error(`No se pudo limpiar ${table}: ${error.message}`);
  }
};

(async () => {
  await resetLocalData();
  const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const call = async (method, path, { token, body, raw } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (raw) return res;
    let json = null;
    try { json = await res.json(); } catch { /* sin cuerpo */ }
    return { status: res.status, body: json };
  };

  const uploadFile = async (token, filename, content, contentTypeOverride) => {
    const { body } = await call('POST', '/documents/upload-url', { token, body: { filename, size: content.length } });
    const info = body.data;
    const form = new FormData();
    form.append('cacheControl', '3600');
    form.append('', new Blob([content], { type: contentTypeOverride || info.contentType }));
    const put = await fetch(info.signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body: form });
    return { info, putStatus: put.status };
  };

  try {
    // ------------------------------------------------------------------
    section('1. Acceso rápido por rol');
    const status = await call('GET', '/auth/demo-status');
    check('demo-status habilitado con 4 roles', status.body?.data?.enabled === true && status.body.data.roles.length === 4, status.body);

    const sessions = {};
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'COLABORADOR', 'CONSULTOR']) {
      const r = await call('POST', '/auth/demo-login', { body: { role } });
      sessions[role] = r.body;
      check(`demo-login ${role}`, r.status === 200 && r.body?.token && r.body.user.role === role, r.body);
    }
    const again = await call('POST', '/auth/demo-login', { body: { role: 'ADMIN' } });
    check('segundo demo-login del mismo rol reutiliza la cuenta', again.status === 200 && again.body.user.id === sessions.ADMIN.user.id);
    check('rol inválido rechazado', (await call('POST', '/auth/demo-login', { body: { role: 'ROOT' } })).status === 400);

    const { data: pendingReqs } = await supabaseAdmin.from('registration_requests').select('id').eq('status', 'pendiente');
    check('las cuentas demo no aparecen como solicitudes de acceso pendientes', (pendingReqs || []).length === 0, pendingReqs);

    const T = Object.fromEntries(Object.entries(sessions).map(([role, s]) => [role, s.token]));
    const ID = Object.fromEntries(Object.entries(sessions).map(([role, s]) => [role, s.user.id]));

    const directory = await call('GET', '/users/directory', { token: T.COLABORADOR });
    check('directorio de usuarios para elegir firmantes (sin correos)', directory.status === 200 && directory.body.data.users.length >= 4 && directory.body.data.users.every(u => !('email' in u)), directory.body);

    const refreshed = await call('POST', '/auth/refresh', { body: { refreshToken: sessions.CONSULTOR.refreshToken } });
    check('renovar sesión con el refreshToken devuelve token nuevo y usuario', refreshed.status === 200 && refreshed.body.token && refreshed.body.user.role === 'CONSULTOR', refreshed.body);
    check('el token renovado funciona', (await call('GET', '/documents', { token: refreshed.body.token })).status === 200);
    check('un refreshToken inventado da 401', (await call('POST', '/auth/refresh', { body: { refreshToken: 'no-existe' } })).status === 401);
    check('sin refreshToken da 400', (await call('POST', '/auth/refresh', { body: {} })).status === 400);
    // el token viejo del consultor sigue siendo valido hasta expirar; se usa el nuevo para el resto de la prueba
    sessions.CONSULTOR.token = refreshed.body.token;

    section('2. Restricciones de las cuentas demo');
    const blocked = await call('POST', '/users/create', { token: T.SUPER_ADMIN, body: { name: 'X', email: 'x@x.com', password: 'Abcdef12', role: 'SUPER_ADMIN' } });
    check('la cuenta demo no puede crear usuarios', blocked.status === 403 && blocked.body?.code === 'DEMO_ACCOUNT_RESTRICTED', blocked.body);
    const blockedPw = await call('PUT', `/admin/users/${ID.ADMIN}/password`, { token: T.SUPER_ADMIN, body: { userId: ID.ADMIN, newPassword: 'Abcdef123' } });
    check('la cuenta demo no puede cambiar contraseñas', blockedPw.status === 403 && blockedPw.body?.code === 'DEMO_ACCOUNT_RESTRICTED', blockedPw.body);
    check('la cuenta demo sí puede leer usuarios (solo lectura)', (await call('GET', '/users', { token: T.SUPER_ADMIN })).status === 200);

    section('3. Estadísticas iniciales (sin documentos)');
    const pub0 = await call('GET', '/public/stats');
    check('estadísticas públicas sin autenticación', pub0.status === 200 && pub0.body.data.compliance === 0 && pub0.body.data.documentsActive === 0, pub0.body);
    const tree = await call('GET', '/norms/tree', { token: T.COLABORADOR });
    const mains = tree.body?.data?.norm?.clauses || [];
    check('árbol ISO con los 7 puntos (4 a 10)', mains.map(c => c.code).join(',') === '4,5,6,7,8,9,10', mains.map(c => c.code));
    check('91 cláusulas en total', tree.body?.data?.norm?.summary?.requirements > 60);

    section('4. Subida directa a Storage + registro del documento');
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    const up = await uploadFile(T.COLABORADOR, 'Procedimiento Recursos.pdf', pdf);
    check('la subida firmada a Storage responde 200', up.putStatus === 200, up.putStatus);

    const consultorUpload = await call('POST', '/documents/upload-url', { token: T.CONSULTOR, body: { filename: 'x.pdf', size: 100 } });
    check('el consultor (solo lectura) no puede subir documentos', consultorUpload.status === 403 && consultorUpload.body.code === 'READ_ONLY_ROLE', consultorUpload.body);
    const badExt = await call('POST', '/documents/upload-url', { token: T.COLABORADOR, body: { filename: 'virus.exe', size: 100 } });
    check('extensión no permitida rechazada', badExt.status === 400 && badExt.body.code === 'INVALID_FILE_TYPE', badExt.body);
    const tooBig = await call('POST', '/documents/upload-url', { token: T.COLABORADOR, body: { filename: 'x.pdf', size: 30 * 1024 * 1024 } });
    check('archivo mayor a 25 MB rechazado', tooBig.status === 413, tooBig.body);

    const stolen = await call('POST', '/documents', { token: T.COLABORADOR, body: { storagePath: `${ID.ADMIN}/otro.pdf`, originalName: 'otro.pdf', clause: '7.1.2' } });
    check('no se puede registrar la ruta de otro usuario', stolen.status === 403, stolen.body);
    const badClause = await call('POST', '/documents', { token: T.COLABORADOR, body: { storagePath: up.info.storagePath, originalName: 'Procedimiento Recursos.pdf', clause: '99.9' } });
    check('cláusula inexistente rechazada', badClause.status === 400 && badClause.body.code === 'INVALID_CLAUSE', badClause.body);
    const mainClause = await call('POST', '/documents', { token: T.COLABORADOR, body: { storagePath: up.info.storagePath, originalName: 'Procedimiento Recursos.pdf', clause: '7' } });
    check('punto principal (7) rechazado: exige subcláusula', mainClause.status === 400 && mainClause.body.code === 'INVALID_CLAUSE', mainClause.body);
    const notUploaded = await call('POST', '/documents', { token: T.COLABORADOR, body: { storagePath: `${ID.COLABORADOR}/no-existe.pdf`, originalName: 'no-existe.pdf', clause: '7.1.2' } });
    check('archivo que nunca se subió rechazado', notUploaded.status === 400 && notUploaded.body.code === 'FILE_NOT_UPLOADED', notUploaded.body);

    const created = await call('POST', '/documents', {
      token: T.COLABORADOR,
      body: {
        storagePath: up.info.storagePath, originalName: 'Procedimiento Recursos.pdf', title: 'Procedimiento de Recursos',
        code: 'PR-REC-001', type: 'Procedimiento', clause: '7.1.2', responsible: 'A. García', version: 'v.02',
        expiryDate: '2027-12-31',
      },
    });
    const doc = created.body?.data?.document;
    check('documento registrado (201)', created.status === 201 && doc?.id, created.body);
    check('guarda la huella SHA-256 del archivo', /^[0-9a-f]{64}$/.test(doc?.sha256 || ''), doc?.sha256);
    check('cláusula, versión y vigencia guardadas', doc?.clause === '7.1.2' && doc?.version === 'v.02' && doc?.expiryDate === '2027-12-31', doc);
    const dup = await call('POST', '/documents', { token: T.COLABORADOR, body: { storagePath: up.info.storagePath, originalName: 'Procedimiento Recursos.pdf', clause: '7.1.2' } });
    check('registrar dos veces el mismo archivo da 409', dup.status === 409, dup.body);

    section('5. Las estadísticas se mueven solas');
    let stats = await call('GET', '/documents/stats', { token: T.CONSULTOR });
    check('documentos vigentes = 1', stats.body?.data?.stats?.vigentes === 1, stats.body?.data?.stats);
    check('cumplimiento ISO global > 0', stats.body?.data?.iso?.overall > 0, stats.body?.data?.iso);
    let clause7 = (stats.body?.data?.tree || []).find(c => c.code === '7');
    check('cláusula 7 con avance', clause7 && clause7.completion > 0 && clause7.docCount === 1, clause7);
    const c712 = await call('GET', '/norms/clauses/7.1.2', { token: T.CONSULTOR });
    check('detalle de 7.1.2 al 50 % con 1 documento', c712.body?.data?.clause?.completion === 50 && c712.body.data.documents.length === 1, c712.body?.data?.clause);
    const compliance = await call('GET', '/norms/compliance-report', { token: T.ADMIN });
    check('compliance-report conserva su formato (completion.overall)', typeof compliance.body?.data?.completion?.overall === 'number' && compliance.body.data.clauses.length === 7, compliance.body?.data?.completion);
    const byClause = await call('GET', '/metrics/compliance/clauses', { token: T.ADMIN });
    check('metrics/compliance/clauses usa el cumplimiento documental', byClause.body?.data?.compliance?.find(c => c.clause === '7')?.compliance > 0, byClause.body?.data?.compliance?.[3]);
    const pub1 = await call('GET', '/public/stats');
    check('las cifras públicas del login reflejan el documento', pub1.body?.data?.documentsActive === 1 && pub1.body.data.compliance > 0, pub1.body);
    const csv = await call('GET', '/norms/clauses/all/export', { token: T.ADMIN, raw: true });
    const csvText = await csv.text();
    check('exportación CSV de toda la norma', csv.status === 200 && csvText.includes('7.1.2') && csvText.includes('Cumplimiento global'), csvText.slice(0, 120));

    section('6. Notificaciones por la subida');
    const adminNotifs = await call('GET', '/notifications', { token: T.ADMIN });
    const uploadNotif = adminNotifs.body?.data?.notifications?.find(n => n.type === 'documento_subido');
    check('el ADMIN recibió aviso de nuevo documento', !!uploadNotif && !uploadNotif.read, adminNotifs.body?.data);
    check('el enlace del aviso apunta a la página de documentos del rol', uploadNotif?.link === `/admin/documentos-iso?doc=${doc.id}`, uploadNotif?.link);
    const saNotifs = await call('GET', '/notifications', { token: T.SUPER_ADMIN });
    check('el SUPER_ADMIN también (enlace propio)', saNotifs.body?.data?.notifications?.some(n => n.link === `/superadmin/documentos?doc=${doc.id}`));
    const colabNotifs = await call('GET', '/notifications', { token: T.COLABORADOR });
    check('quien sube no se auto-notifica', !colabNotifs.body?.data?.notifications?.some(n => n.type === 'documento_subido'));

    section('7. Visualizar y descargar (URL firmada)');
    const urlRes = await call('GET', `/documents/${doc.id}/url`, { token: T.CONSULTOR });
    check('URL firmada generada', urlRes.status === 200 && urlRes.body.data.url.startsWith('http'), urlRes.body);
    const fileRes = await fetch(urlRes.body.data.url);
    const fileBuf = Buffer.from(await fileRes.arrayBuffer());
    check('el archivo descargado es idéntico al subido', fileRes.status === 200 && fileBuf.equals(pdf));
    const dlRes = await call('GET', `/documents/${doc.id}/url?download=1`, { token: T.CONSULTOR });
    const dlFile = await fetch(dlRes.body.data.url);
    check('modo descarga fuerza Content-Disposition', /attachment/i.test(dlFile.headers.get('content-disposition') || ''), dlFile.headers.get('content-disposition'));

    section('8. Firmas: solicitud, recordatorio y firma');
    const noPerm = await call('POST', `/documents/${doc.id}/signatures/request`, { token: T.CONSULTOR, body: { userIds: [ID.ADMIN] } });
    check('un tercero (consultor) no puede pedir firmas', noPerm.status === 403, noPerm.body);
    const noTerms = await call('POST', `/documents/${doc.id}/sign`, { token: T.CONSULTOR, body: { signatureImage: PNG_DATA_URL } });
    check('firmar exige aceptar la declaración', noTerms.status === 400 && noTerms.body.code === 'TERMS_NOT_ACCEPTED', noTerms.body);
    const badImg = await call('POST', `/documents/${doc.id}/sign`, { token: T.CONSULTOR, body: { accept: true, signatureImage: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } });
    check('solo se aceptan firmas en PNG', badImg.status === 400 && badImg.body.code === 'INVALID_SIGNATURE_IMAGE', badImg.body);

    const reqSig = await call('POST', `/documents/${doc.id}/signatures/request`, { token: T.ADMIN, body: { userIds: [ID.COLABORADOR, ID.CONSULTOR], message: 'Favor de firmar hoy' } });
    check('solicitud de firma a 2 personas', reqSig.status === 201 && reqSig.body.data.requested === 2, reqSig.body);
    let docs = await call('GET', '/documents', { token: T.COLABORADOR });
    let d1 = docs.body.data.documents.find(d => d.id === doc.id);
    check('el documento pasa a "en revisión" mientras se firma', d1.status === 'en_revision', d1.status);
    check('el colaborador ve que tiene una firma pendiente', d1.signatures.pendingForMe === true && d1.signatures.pending === 2, d1.signatures);
    stats = await call('GET', '/documents/stats', { token: T.COLABORADOR });
    check('stats: pendientesParaMi = 1', stats.body.data.stats.pendientesParaMi === 1, stats.body.data.stats);

    let colabN = await call('GET', '/notifications', { token: T.COLABORADOR });
    const sigNotif = colabN.body.data.notifications.find(n => n.type === 'firma_solicitada');
    check('el colaborador recibió la solicitud de firma', !!sigNotif && sigNotif.link === `/colaborador/documentos?doc=${doc.id}&firmar=1`, sigNotif);

    await call('PATCH', `/notifications/${sigNotif.id}/read`, { token: T.COLABORADOR });
    const sigs = await call('GET', `/documents/${doc.id}/signatures`, { token: T.ADMIN });
    const colabSig = sigs.body.data.signatures.find(s => s.signerId === ID.COLABORADOR);
    const resend = await call('POST', `/documents/${doc.id}/signatures/${colabSig.id}/resend`, { token: T.ADMIN });
    check('recordatorio de firma reenviado', resend.status === 200 && resend.body.data.reminderCount === 1, resend.body);
    colabN = await call('GET', '/notifications', { token: T.COLABORADOR });
    const sigNotifs = colabN.body.data.notifications.filter(n => n.type === 'firma_solicitada');
    check('el recordatorio reutiliza la notificación (sin duplicar) y vuelve a no leída', sigNotifs.length === 1 && !sigNotifs[0].read && sigNotifs[0].resendCount >= 1, sigNotifs);
    const resendByOther = await call('POST', `/documents/${doc.id}/signatures/${colabSig.id}/resend`, { token: T.CONSULTOR });
    check('un tercero no puede reenviar recordatorios', resendByOther.status === 403, resendByOther.body);

    const signColab = await call('POST', `/documents/${doc.id}/sign`, { token: T.COLABORADOR, body: { accept: true, signatureImage: PNG_DATA_URL, comment: 'Conforme' } });
    check('el colaborador firma', signColab.status === 201 && signColab.body.data.signature.status === 'firmada' && !signColab.body.data.approved, signColab.body);
    check('la huella de firma es SHA-256', /^[0-9a-f]{64}$/.test(signColab.body.data.signature.signatureHash || ''));
    const signAgain = await call('POST', `/documents/${doc.id}/sign`, { token: T.COLABORADOR, body: { accept: true } });
    check('no se puede firmar dos veces', signAgain.status === 409 && signAgain.body.code === 'ALREADY_SIGNED', signAgain.body);
    colabN = await call('GET', '/notifications', { token: T.COLABORADOR });
    check('al firmar desaparece su aviso de firma pendiente', !colabN.body.data.notifications.some(n => n.type === 'firma_solicitada'));
    const adminN2 = await call('GET', '/notifications', { token: T.ADMIN });
    check('quien pidió la firma recibe el aviso "firmado"', adminN2.body.data.notifications.some(n => n.type === 'documento_firmado'));

    stats = await call('GET', '/documents/stats', { token: T.ADMIN });
    const c712b = await call('GET', '/norms/clauses/7.1.2', { token: T.ADMIN });
    check('con una firma pero otra pendiente sigue en revisión (50 %)', c712b.body.data.clause.completion === 50, c712b.body.data.clause);

    const signCons = await call('POST', `/documents/${doc.id}/sign`, { token: T.CONSULTOR, body: { accept: true } });
    check('la última firma aprueba el documento', signCons.status === 201 && signCons.body.data.approved === true, signCons.body);
    docs = await call('GET', '/documents', { token: T.ADMIN });
    d1 = docs.body.data.documents.find(d => d.id === doc.id);
    check('el documento vuelve a "vigente" con 2 firmas', d1.status === 'vigente' && d1.signatures.signed === 2 && d1.signatures.pending === 0, d1.signatures);
    const c712c = await call('GET', '/norms/clauses/7.1.2', { token: T.ADMIN });
    check('la cláusula 7.1.2 llega al 100 %', c712c.body.data.clause.completion === 100 && c712c.body.data.clause.status === 'completo', c712c.body.data.clause);
    stats = await call('GET', '/documents/stats', { token: T.ADMIN });
    check('stats: 1 firmado, 0 pendientes', stats.body.data.stats.firmados === 1 && stats.body.data.stats.firmasPendientes === 0, stats.body.data.stats);

    const detail = await call('GET', `/documents/${doc.id}/signatures`, { token: T.CONSULTOR });
    const imgSig = detail.body.data.signatures.find(s => s.signerId === ID.COLABORADOR);
    check('el detalle devuelve la imagen de la firma, fecha y comentario', imgSig.signatureImage === PNG_DATA_URL && imgSig.signedAt && imgSig.comment === 'Conforme', imgSig);
    const verify = await call('GET', `/documents/${doc.id}/verify`, { token: T.ADMIN });
    check('verificación de integridad: archivo intacto y firmas válidas', verify.body.data.fileIntact === true && verify.body.data.signatures.length === 2 && verify.body.data.signatures.every(s => s.valid), verify.body);

    const { error: tamperSig } = await supabaseAdmin.from('document_signatures').update({ comment: 'alterado' }).eq('id', imgSig.id);
    check('una firma emitida es inmutable (trigger en la base)', !!tamperSig && /no puede modificarse/i.test(tamperSig.message), tamperSig);
    const cancelSigned = await call('DELETE', `/documents/${doc.id}/signatures/${imgSig.id}`, { token: T.ADMIN });
    check('una firma emitida no se puede cancelar', cancelSigned.status === 409, cancelSigned.body);

    section('9. Integridad: archivo alterado');
    const up2 = await uploadFile(T.ADMIN, 'Manual SGC.pdf', Buffer.from('%PDF-1.4 original'));
    const doc2 = (await call('POST', '/documents', { token: T.ADMIN, body: { storagePath: up2.info.storagePath, originalName: 'Manual SGC.pdf', title: 'Manual del SGC', clause: '4.4.2', type: 'Manual' } })).body.data.document;
    check('documento sin código recibe uno generado', /^DOC-\d{8}-[0-9A-F]{4}$/.test(doc2.code), doc2.code);
    await supabaseAdmin.storage.from('documents').update(up2.info.storagePath, Buffer.from('%PDF-1.4 ALTERADO'), { contentType: 'application/pdf' });
    const tampered = await call('POST', `/documents/${doc2.id}/sign`, { token: T.CONSULTOR, body: { accept: true } });
    check('firmar un archivo alterado se bloquea', tampered.status === 409 && tampered.body.code === 'DOCUMENT_TAMPERED', tampered.body);
    const verify2 = await call('GET', `/documents/${doc2.id}/verify`, { token: T.ADMIN });
    check('la verificación detecta el archivo alterado', verify2.body.data.fileIntact === false, verify2.body.data);

    section('10. Edición, permisos y baja');
    const editByOther = await call('PUT', `/documents/${doc.id}`, { token: T.CONSULTOR, body: { title: 'hack' } });
    check('un tercero no puede editar', editByOther.status === 403, editByOther.body);
    const editOwn = await call('PUT', `/documents/${doc.id}`, { token: T.COLABORADOR, body: { title: 'Procedimiento de Recursos (rev.)', version: 'v.03', expiryDate: null } });
    check('el autor edita su documento (y limpia la vigencia)', editOwn.status === 200 && editOwn.body.data.document.version === 'v.03' && editOwn.body.data.document.expiryDate === null, editOwn.body);
    const editBad = await call('PUT', `/documents/${doc.id}`, { token: T.ADMIN, body: { clause: '3.1' } });
    check('editar con cláusula inválida se rechaza', editBad.status === 400, editBad.body);
    const expired = await call('PUT', `/documents/${doc2.id}`, { token: T.ADMIN, body: { expiryDate: '2020-01-01' } });
    check('con vigencia pasada el estado efectivo es "vencido"', expired.body.data.document.status === 'vencido', expired.body.data.document.status);
    const signExpired = await call('POST', `/documents/${doc2.id}/sign`, { token: T.CONSULTOR, body: { accept: true } });
    check('no se firma un documento vencido', signExpired.status === 409 && signExpired.body.code === 'DOCUMENT_NOT_SIGNABLE', signExpired.body);
    stats = await call('GET', '/documents/stats', { token: T.ADMIN });
    check('stats: 1 vencido', stats.body.data.stats.vencidos === 1, stats.body.data.stats);
    const delByOther = await call('DELETE', `/documents/${doc2.id}`, { token: T.COLABORADOR });
    check('un colaborador no puede borrar el documento de otro', delByOther.status === 403, delByOther.body);

    const search = await call('GET', '/documents?search=Recursos', { token: T.CONSULTOR });
    check('búsqueda por texto', search.body.data.documents.length === 1 && search.body.data.documents[0].id === doc.id, search.body.data.documents.length);
    const inject = await call('GET', '/documents?search=' + encodeURIComponent('x%,id.neq.0)'), { token: T.CONSULTOR });
    check('la búsqueda no permite inyectar filtros', inject.status === 200);
    const countBy = async (q) => (await call('GET', `/documents?clause=${q}`, { token: T.CONSULTOR })).body.data.documents.length;
    check('filtro por cláusula incluye subcláusulas (7 y 7.1 contienen a 7.1.2; 7.2 no)', (await countBy('7')) === 1 && (await countBy('7.1')) === 1 && (await countBy('7.2')) === 0);

    const beforeDel = await supabaseAdmin.storage.from('documents').download(doc.filename || up.info.storagePath);
    check('antes de borrar el archivo existe en Storage', !beforeDel.error);
    const del = await call('DELETE', `/documents/${doc.id}`, { token: T.COLABORADOR });
    check('el autor elimina su documento', del.status === 200, del.body);
    const afterDel = await supabaseAdmin.storage.from('documents').download(up.info.storagePath);
    check('el archivo se borra también de Storage', !!afterDel.error);
    const { count: sigLeft } = await supabaseAdmin.from('document_signatures').select('id', { count: 'exact', head: true }).eq('document_id', doc.id);
    check('las firmas se eliminan en cascada', sigLeft === 0, sigLeft);
    check('el documento ya no se puede consultar (404)', (await call('GET', `/documents/${doc.id}`, { token: T.ADMIN })).status === 404);
    stats = await call('GET', '/documents/stats', { token: T.ADMIN });
    check('las estadísticas se recalculan al borrar', stats.body.data.stats.total === 1, stats.body.data.stats);
    const del2 = await call('DELETE', `/documents/${doc2.id}`, { token: T.ADMIN });
    check('un administrador elimina documentos ajenos', del2.status === 200, del2.body);
    stats = await call('GET', '/documents/stats', { token: T.ADMIN });
    check('vuelve a 0 documentos y 0 % de cumplimiento', stats.body.data.stats.total === 0 && stats.body.data.iso.overall === 0, stats.body.data);

    section('11. Bandeja de notificaciones');
    const send = await call('POST', '/notifications/send', { token: T.ADMIN, body: { role: 'COLABORADOR', title: 'Reunión de calidad', message: 'Mañana 9:00', severity: 'warning' } });
    check('aviso manual a todo un rol', send.status === 201 && send.body.data.sent === 1, send.body);
    const denied = await call('POST', '/notifications/send', { token: T.COLABORADOR, body: { role: 'ADMIN', title: 'x' } });
    check('un colaborador no puede enviar avisos', denied.status === 403);
    check('el aviso exige título y destinatario', (await call('POST', '/notifications/send', { token: T.ADMIN, body: { title: 'x' } })).status === 400);

    let inbox = await call('GET', '/notifications', { token: T.COLABORADOR });
    const aviso = inbox.body.data.notifications.find(n => n.title === 'Reunión de calidad');
    check('el colaborador ve el aviso con su severidad', aviso && aviso.severity === 'warning' && aviso.link === '/colaborador/notificaciones', aviso);
    const unread0 = inbox.body.data.unreadCount;
    check('contador de no leídas correcto', unread0 >= 1, unread0);

    const sent = await call('GET', '/notifications/sent', { token: T.ADMIN });
    const sentAviso = sent.body.data.notifications.find(n => n.id === aviso.id);
    check('el administrador ve lo que envió (con destinatario)', sentAviso?.recipient?.id === ID.COLABORADOR, sentAviso);

    await call('PATCH', `/notifications/${aviso.id}/read`, { token: T.COLABORADOR });
    inbox = await call('GET', '/notifications?unread=true', { token: T.COLABORADOR });
    check('marcar como leída baja el contador', inbox.body.data.unreadCount === unread0 - 1 && !inbox.body.data.notifications.some(n => n.id === aviso.id), inbox.body.data.unreadCount);
    const resendNotif = await call('POST', `/notifications/${aviso.id}/resend`, { token: T.ADMIN });
    check('el remitente reenvía la notificación', resendNotif.status === 200 && resendNotif.body.data.notification.resendCount === 1 && resendNotif.body.data.notification.read === false, resendNotif.body);
    const resendDenied = await call('POST', `/notifications/${aviso.id}/resend`, { token: T.CONSULTOR });
    check('un tercero no puede reenviarla', resendDenied.status === 403, resendDenied.body);
    const cross = await call('PATCH', `/notifications/${aviso.id}/read`, { token: T.CONSULTOR });
    check('nadie puede leer/marcar las notificaciones de otro', cross.status === 404);
    const crossDel = await call('DELETE', `/notifications/${aviso.id}`, { token: T.CONSULTOR });
    check('ni borrarlas', crossDel.status === 404);

    const readAll = await call('POST', '/notifications/read-all', { token: T.COLABORADOR });
    inbox = await call('GET', '/notifications', { token: T.COLABORADOR });
    check('marcar todas como leídas', readAll.status === 200 && inbox.body.data.unreadCount === 0, inbox.body.data.unreadCount);
    const clear = await call('DELETE', '/notifications/read', { token: T.COLABORADOR });
    inbox = await call('GET', '/notifications', { token: T.COLABORADOR });
    check('limpiar leídas vacía la bandeja', clear.status === 200 && inbox.body.data.notifications.length === 0, inbox.body.data);
    await call('POST', '/notifications/send', { token: T.SUPER_ADMIN, body: { userIds: [ID.ADMIN], title: 'Aviso para borrar' } });
    const adminInbox = await call('GET', '/notifications', { token: T.ADMIN });
    const toDelete = adminInbox.body.data.notifications.find(n => n.title === 'Aviso para borrar');
    const delOne = await call('DELETE', `/notifications/${toDelete.id}`, { token: T.ADMIN });
    check('borrar una notificación propia', delOne.status === 200, delOne.body);
    check('borrarla otra vez da 404', (await call('DELETE', `/notifications/${toDelete.id}`, { token: T.ADMIN })).status === 404);

    section('12. Tareas, auditorías y hallazgos notifican al responsable');
    const action = await call('POST', '/actions', { token: T.ADMIN, body: { title: 'Actualizar FO-CAL-012', description: 'Revisión anual', area: 'Calidad', assignedTo: ID.COLABORADOR, dueDate: '2026-12-01', priority: 'high' } });
    check('crear tarea asignada', action.status === 201, action.body);
    const actionId = action.body?.data?.id;
    check('un colaborador no puede crear acciones', (await call('POST', '/actions', { token: T.COLABORADOR, body: { title: 'x' } })).status === 403);
    check('una acción sin título se rechaza', (await call('POST', '/actions', { token: T.ADMIN, body: { description: 'sin titulo' } })).status === 400);
    check('prioridad inválida rechazada', (await call('PUT', `/actions/${actionId}`, { token: T.ADMIN, body: { priority: 'urgentisima' } })).status === 400);
    const colabActions = await call('GET', '/actions', { token: T.COLABORADOR });
    check('el colaborador ve solo sus tareas', colabActions.body.data.actions.length >= 1 && colabActions.body.data.actions.every(a => a.assignedTo?.id === ID.COLABORADOR), colabActions.body.data.actions.length);
    check('un consultor no puede cambiar el estado de una tarea ajena', (await call('PUT', `/actions/${actionId}`, { token: T.CONSULTOR, body: { status: 'Cerrada' } })).status === 403);
    check('el asignado no puede editar el título ni reasignar', (await call('PUT', `/actions/${actionId}`, { token: T.COLABORADOR, body: { title: 'hack', assignedTo: ID.ADMIN } })).status === 403);
    const statusOk = await call('PUT', `/actions/${actionId}`, { token: T.COLABORADOR, body: { status: 'En Proceso' } });
    check('el asignado sí puede cambiar el estado de su tarea', statusOk.status === 200 && statusOk.body.data.status === 'En Proceso', statusOk.body);
    check('un colaborador no puede eliminar acciones', (await call('DELETE', `/actions/${actionId}`, { token: T.COLABORADOR })).status === 403);
    inbox = await call('GET', '/notifications', { token: T.COLABORADOR });
    const taskN = inbox.body.data.notifications.find(n => n.type === 'tarea_asignada');
    check('el colaborador recibe "tarea asignada" con enlace a Mis Tareas', taskN && taskN.link === '/colaborador/tareas' && taskN.severity === 'warning', taskN);
    const audit = await call('POST', '/audits', { token: T.ADMIN, body: { title: 'Auditoría interna Q4', description: 'Cláusula 8', date: '2026-11-15', assignedTo: ID.CONSULTOR } });
    check('crear auditoría asignada', audit.status === 201, audit.body);
    inbox = await call('GET', '/notifications', { token: T.CONSULTOR });
    check('el consultor recibe "auditoría asignada"', inbox.body.data.notifications.some(n => n.type === 'auditoria_asignada' && n.link === '/consultor/auditorias'), inbox.body.data.notifications);
    const finding = await call('POST', '/findings', { token: T.COLABORADOR, body: { title: 'Falta calibración', description: 'Balanza sin etiqueta', severity: 'Alta', area: 'Producción', clause: '7.1.5.2' } });
    check('reportar hallazgo', finding.status === 201, finding.body);
    inbox = await call('GET', '/notifications', { token: T.ADMIN });
    check('los administradores reciben el hallazgo', inbox.body.data.notifications.some(n => n.type === 'hallazgo_nuevo' && n.severity === 'error'), inbox.body.data.notifications.map(n => n.type));
    const calEv = await call('POST', '/calendars', { token: T.ADMIN, body: { title: 'Capacitación ISO', date: '2026-10-10', type: 'Capacitación', assignedTo: ID.COLABORADOR } });
    check('crear evento de calendario', calEv.status === 201, calEv.body);
    inbox = await call('GET', '/notifications', { token: T.COLABORADOR });
    check('el colaborador recibe "evento asignado"', inbox.body.data.notifications.some(n => n.type === 'evento_asignado' && n.link === '/colaborador/calendario'), inbox.body.data.notifications.map(n => n.type));

    // limpieza de lo creado en esta sección para dejar la base local como estaba
    await supabaseAdmin.from('actions').delete().eq('title', 'Actualizar FO-CAL-012');
    await supabaseAdmin.from('audits').delete().eq('title', 'Auditoría interna Q4');
    await supabaseAdmin.from('findings').delete().eq('title', 'Falta calibración');
    await supabaseAdmin.from('calendar_events').delete().eq('title', 'Capacitación ISO');

    section('13. Usuario desactivado');
    await supabaseAdmin.from('profiles').update({ active: false }).eq('id', ID.CONSULTOR);
    check('un usuario desactivado ya no entra con su token', (await call('GET', '/documents', { token: T.CONSULTOR })).status === 403);
    await supabaseAdmin.from('profiles').update({ active: true }).eq('id', ID.CONSULTOR);
    check('reactivado vuelve a entrar', (await call('GET', '/documents', { token: T.CONSULTOR })).status === 200);
  } catch (error) {
    failures += 1;
    console.error('\nERROR INESPERADO:', error);
  } finally {
    server.close();
  }

  console.log(`\n${passed} comprobaciones correctas, ${failures} fallidas`);
  process.exit(failures ? 1 : 0);
})();
