// Calculo de cumplimiento ISO 9001:2015 a partir de documentos y firmas.
// Funciones puras (sin acceso a base de datos) para poder probarlas de forma aislada.
//
// Regla de negocio (la misma se explica en la interfaz):
//   - Una clausula "hoja" (sin subclausulas) sin documentos vinculados        -> 0 %   (pendiente)
//   - Con al menos un documento vigente o en revision, pero ninguno firmado   -> 50 %  (en progreso)
//   - Con al menos un documento vigente y firmado                             -> 100 % (completa)
// Un documento vinculado a una clausula "padre" (ej. 7.1) sirve como evidencia de
// todas sus subclausulas (7.1.1 ... 7.1.6). Los documentos vencidos o archivados no cuentan.
// El avance de una clausula con hijos es el promedio ponderado de sus hojas.

const EXPIRING_SOON_DAYS = 30;

const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

// Estado "real" de un documento: la fecha de vigencia manda sobre el estado guardado.
const effectiveStatus = (doc, now = new Date()) => {
  if (doc.status === 'archivado') return 'archivado';
  if (doc.expiry_date && String(doc.expiry_date).slice(0, 10) < todayISO(now)) return 'vencido';
  if (doc.status === 'vencido') return 'vencido';
  if (doc.status === 'en_revision') return 'en_revision';
  return 'vigente';
};

const isExpiringSoon = (doc, now = new Date()) => {
  if (!doc.expiry_date || effectiveStatus(doc, now) !== 'vigente') return false;
  const limit = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
  return String(doc.expiry_date).slice(0, 10) <= todayISO(limit);
};

const compareCodes = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
};

const ancestorsOf = (code, byCode) => {
  const result = [];
  let parent = byCode.get(code)?.parent_code;
  while (parent) {
    result.push(parent);
    parent = byCode.get(parent)?.parent_code;
  }
  return result;
};

/**
 * @param {Array} clauses      filas de iso_clauses
 * @param {Array} documents    filas de documents (id, clause, status, expiry_date)
 * @param {Array} signatures   filas de document_signatures (document_id, status)
 * @returns {{ tree: Array, summary: object }}
 */
const buildIsoCompliance = (clauses, documents, signatures, now = new Date()) => {
  const sorted = [...clauses].sort((a, b) => a.sort_order - b.sort_order || compareCodes(a.code, b.code));
  const byCode = new Map(sorted.map(c => [c.code, { ...c, children: [] }]));

  sorted.forEach(c => {
    const node = byCode.get(c.code);
    if (c.parent_code && byCode.has(c.parent_code)) byCode.get(c.parent_code).children.push(node);
  });

  const signedDocIds = new Set(
    signatures.filter(s => s.status === 'firmada').map(s => s.document_id)
  );

  // Documentos indexados por el codigo de clausula al que estan vinculados.
  const docsByClause = new Map();
  let unclassified = 0;
  documents.forEach(doc => {
    const status = effectiveStatus(doc, now);
    const code = doc.clause ? String(doc.clause).trim() : '';
    // Los puntos principales (4 a 10) son demasiado amplios para ser evidencia:
    // un documento debe vincularse como minimo a una subclausula (x.y).
    if (!byCode.has(code) || byCode.get(code).level < 2) {
      unclassified += 1;
      return;
    }
    if (!docsByClause.has(code)) docsByClause.set(code, []);
    docsByClause.get(code).push({ id: doc.id, status, signed: signedDocIds.has(doc.id) });
  });

  const evidenceFor = (code) => {
    const codes = [code, ...ancestorsOf(code, byCode)];
    return codes.flatMap(c => docsByClause.get(c) || []);
  };

  const descendantDocIds = (node) => {
    const ids = new Set((docsByClause.get(node.code) || []).map(d => d.id));
    node.children.forEach(child => descendantDocIds(child).forEach(id => ids.add(id)));
    return ids;
  };

  const compute = (node) => {
    if (node.children.length === 0) {
      const evidence = evidenceFor(node.code);
      const counting = evidence.filter(d => d.status === 'vigente' || d.status === 'en_revision');
      const approved = counting.some(d => d.status === 'vigente' && d.signed);
      const completion = approved ? 100 : counting.length > 0 ? 50 : 0;
      node.completion = completion;
      node.status = completion === 100 ? 'completo' : completion > 0 ? 'en_progreso' : 'pendiente';
      node.leafCount = 1;
      node.leafCompleted = completion === 100 ? 1 : 0;
      node.leafInProgress = completion === 50 ? 1 : 0;
      node.leafPending = completion === 0 ? 1 : 0;
      node.docCount = new Set(evidence.map(d => d.id)).size;
      node.signedCount = new Set(evidence.filter(d => d.signed).map(d => d.id)).size;
      node.ownDocCount = (docsByClause.get(node.code) || []).length;
      node.leafCompletionSum = completion;
      return node;
    }

    node.children.forEach(compute);
    node.leafCount = node.children.reduce((s, c) => s + c.leafCount, 0);
    node.leafCompleted = node.children.reduce((s, c) => s + c.leafCompleted, 0);
    node.leafInProgress = node.children.reduce((s, c) => s + c.leafInProgress, 0);
    node.leafPending = node.children.reduce((s, c) => s + c.leafPending, 0);
    node.leafCompletionSum = node.children.reduce((s, c) => s + c.leafCompletionSum, 0);
    node.completion = node.leafCount ? Math.round(node.leafCompletionSum / node.leafCount) : 0;
    node.status = node.completion === 100 ? 'completo' : node.completion > 0 ? 'en_progreso' : 'pendiente';

    const related = new Set([
      ...descendantDocIds(node),
      ...ancestorsOf(node.code, byCode).flatMap(c => (docsByClause.get(c) || []).map(d => d.id)),
    ]);
    node.docCount = related.size;
    node.signedCount = [...related].filter(id => signedDocIds.has(id)).length;
    node.ownDocCount = (docsByClause.get(node.code) || []).length;
    return node;
  };

  const roots = sorted.filter(c => !c.parent_code || !byCode.has(c.parent_code)).map(c => compute(byCode.get(c.code)));

  const leafCount = roots.reduce((s, r) => s + r.leafCount, 0);
  const leafCompleted = roots.reduce((s, r) => s + r.leafCompleted, 0);
  const leafInProgress = roots.reduce((s, r) => s + r.leafInProgress, 0);
  const leafPending = roots.reduce((s, r) => s + r.leafPending, 0);
  const sum = roots.reduce((s, r) => s + r.leafCompletionSum, 0);

  const strip = (node) => ({
    code: node.code,
    parentCode: node.parent_code || null,
    level: node.level,
    title: node.title,
    description: node.description,
    completion: node.completion,
    status: node.status,
    docCount: node.docCount,
    ownDocCount: node.ownDocCount,
    signedCount: node.signedCount,
    leafCount: node.leafCount,
    leafCompleted: node.leafCompleted,
    children: node.children.map(strip),
  });

  return {
    tree: roots.map(strip),
    summary: {
      overall: leafCount ? Math.round(sum / leafCount) : 0,
      mainClauses: roots.length,
      mainClausesCompleted: roots.filter(r => r.status === 'completo').length,
      mainClausesInProgress: roots.filter(r => r.status === 'en_progreso').length,
      mainClausesPending: roots.filter(r => r.status === 'pendiente').length,
      requirements: leafCount,
      requirementsCompleted: leafCompleted,
      requirementsInProgress: leafInProgress,
      requirementsPending: leafPending,
      unclassifiedDocuments: unclassified,
    },
  };
};

// Estadisticas de documentos (independientes del catalogo ISO).
const buildDocumentStats = (documents, signatures, userId = null, now = new Date()) => {
  const signedDocIds = new Set(signatures.filter(s => s.status === 'firmada').map(s => s.document_id));
  const stats = {
    total: documents.length,
    vigentes: 0,
    enRevision: 0,
    vencidos: 0,
    archivados: 0,
    porVencer: 0,
    firmados: 0,
    sinFirma: 0,
    firmasPendientes: signatures.filter(s => s.status === 'pendiente').length,
    pendientesParaMi: userId
      ? signatures.filter(s => s.status === 'pendiente' && s.signer_id === userId).length
      : 0,
  };

  documents.forEach(doc => {
    const status = effectiveStatus(doc, now);
    if (status === 'vigente') stats.vigentes += 1;
    else if (status === 'en_revision') stats.enRevision += 1;
    else if (status === 'vencido') stats.vencidos += 1;
    else stats.archivados += 1;
    if (isExpiringSoon(doc, now)) stats.porVencer += 1;
    if (signedDocIds.has(doc.id)) stats.firmados += 1;
    else stats.sinFirma += 1;
  });

  return stats;
};

module.exports = {
  EXPIRING_SOON_DAYS,
  effectiveStatus,
  isExpiringSoon,
  compareCodes,
  buildIsoCompliance,
  buildDocumentStats,
};
