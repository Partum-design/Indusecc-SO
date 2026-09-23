const {
  effectiveStatus,
  isExpiringSoon,
  compareCodes,
  buildIsoCompliance,
  buildDocumentStats,
} = require('../src/utils/isoStats');
const { sha256, computeSignatureHash } = require('../src/utils/signature');

const NOW = new Date('2026-09-23T12:00:00Z');

// Mini catálogo: 7 (padre) -> 7.1 (padre) -> 7.1.1, 7.1.2 ; 7.2 (hoja) ; 8 -> 8.1 (hoja)
const clauses = [
  { code: '7', parent_code: null, level: 1, title: 'Apoyo', description: '', sort_order: 10 },
  { code: '7.1', parent_code: '7', level: 2, title: 'Recursos', description: '', sort_order: 20 },
  { code: '7.1.1', parent_code: '7.1', level: 3, title: 'Generalidades', description: '', sort_order: 30 },
  { code: '7.1.2', parent_code: '7.1', level: 3, title: 'Personas', description: '', sort_order: 40 },
  { code: '7.2', parent_code: '7', level: 2, title: 'Competencia', description: '', sort_order: 50 },
  { code: '8', parent_code: null, level: 1, title: 'Operación', description: '', sort_order: 60 },
  { code: '8.1', parent_code: '8', level: 2, title: 'Planificación', description: '', sort_order: 70 },
];

const doc = (id, clause, extra = {}) => ({ id, clause, status: 'vigente', expiry_date: null, ...extra });
const signed = (documentId, signer = 'u1') => ({ document_id: documentId, signer_id: signer, status: 'firmada' });
const pending = (documentId, signer = 'u2') => ({ document_id: documentId, signer_id: signer, status: 'pendiente' });

const find = (tree, code) => {
  for (const node of tree) {
    if (node.code === code) return node;
    const hit = find(node.children, code);
    if (hit) return hit;
  }
  return null;
};

describe('effectiveStatus / isExpiringSoon', () => {
  it('respeta la fecha de vigencia por encima del estado guardado', () => {
    expect(effectiveStatus({ status: 'vigente', expiry_date: '2026-09-22' }, NOW)).toBe('vencido');
    expect(effectiveStatus({ status: 'vigente', expiry_date: '2026-09-23' }, NOW)).toBe('vigente');
    expect(effectiveStatus({ status: 'vigente', expiry_date: null }, NOW)).toBe('vigente');
  });

  it('mantiene archivado y en revisión', () => {
    expect(effectiveStatus({ status: 'archivado', expiry_date: '2020-01-01' }, NOW)).toBe('archivado');
    expect(effectiveStatus({ status: 'en_revision', expiry_date: null }, NOW)).toBe('en_revision');
  });

  it('marca por vencer solo los vigentes a 30 días o menos', () => {
    expect(isExpiringSoon({ status: 'vigente', expiry_date: '2026-10-20' }, NOW)).toBe(true);
    expect(isExpiringSoon({ status: 'vigente', expiry_date: '2026-12-31' }, NOW)).toBe(false);
    expect(isExpiringSoon({ status: 'vigente', expiry_date: '2026-09-01' }, NOW)).toBe(false); // ya vencido
    expect(isExpiringSoon({ status: 'en_revision', expiry_date: '2026-10-20' }, NOW)).toBe(false);
  });
});

describe('compareCodes', () => {
  it('ordena numéricamente (10 después de 9, 7.1.10 después de 7.1.2)', () => {
    expect(['10', '9', '4.10', '4.2', '7.1.10', '7.1.2'].sort(compareCodes)).toEqual(['4.2', '4.10', '7.1.2', '7.1.10', '9', '10']);
  });
});

describe('buildIsoCompliance', () => {
  it('sin documentos todo está pendiente y en 0 %', () => {
    const { tree, summary } = buildIsoCompliance(clauses, [], [], NOW);
    expect(summary.overall).toBe(0);
    expect(summary.requirements).toBe(4); // 7.1.1, 7.1.2, 7.2, 8.1
    expect(summary.requirementsPending).toBe(4);
    expect(find(tree, '7').status).toBe('pendiente');
  });

  it('subir un documento a una hoja la deja en 50 % (en progreso)', () => {
    const { tree, summary } = buildIsoCompliance(clauses, [doc('d1', '8.1')], [], NOW);
    expect(find(tree, '8.1').completion).toBe(50);
    expect(find(tree, '8.1').status).toBe('en_progreso');
    expect(find(tree, '8').completion).toBe(50);
    expect(summary.requirementsInProgress).toBe(1);
  });

  it('firmarlo la lleva al 100 % (completo)', () => {
    const { tree, summary } = buildIsoCompliance(clauses, [doc('d1', '8.1')], [signed('d1')], NOW);
    expect(find(tree, '8.1').completion).toBe(100);
    expect(find(tree, '8').status).toBe('completo');
    expect(summary.mainClausesCompleted).toBe(1);
    expect(summary.overall).toBe(25); // 1 de 4 requisitos completo
  });

  it('una firma pendiente no cuenta como aprobación', () => {
    const { tree } = buildIsoCompliance(clauses, [doc('d1', '8.1')], [pending('d1')], NOW);
    expect(find(tree, '8.1').completion).toBe(50);
  });

  it('un documento en revisión aunque tenga firma no llega a 100 %', () => {
    const { tree } = buildIsoCompliance(clauses, [doc('d1', '8.1', { status: 'en_revision' })], [signed('d1')], NOW);
    expect(find(tree, '8.1').completion).toBe(50);
  });

  it('un documento en una cláusula padre respalda a todas sus subcláusulas', () => {
    const { tree } = buildIsoCompliance(clauses, [doc('d1', '7.1')], [signed('d1')], NOW);
    expect(find(tree, '7.1.1').completion).toBe(100);
    expect(find(tree, '7.1.2').completion).toBe(100);
    expect(find(tree, '7.1').completion).toBe(100);
    expect(find(tree, '7.2').completion).toBe(0); // hermana: no hereda
    expect(find(tree, '7').completion).toBe(67); // 2 de 3 hojas
  });

  it('promedia ponderando por hojas', () => {
    const docs = [doc('a', '7.1.1'), doc('b', '7.1.2'), doc('c', '7.2')];
    const { tree } = buildIsoCompliance(clauses, docs, [signed('a')], NOW);
    expect(find(tree, '7.1').completion).toBe(75); // (100 + 50) / 2
    expect(find(tree, '7').completion).toBe(67); // (100 + 50 + 50) / 3
  });

  it('ignora documentos vencidos y archivados', () => {
    const docs = [doc('a', '8.1', { expiry_date: '2026-01-01' }), doc('b', '8.1', { status: 'archivado' })];
    const { tree } = buildIsoCompliance(clauses, docs, [signed('a'), signed('b')], NOW);
    expect(find(tree, '8.1').completion).toBe(0);
  });

  it('un documento vencido no invalida a otro vigente y firmado de la misma cláusula', () => {
    const docs = [doc('old', '8.1', { expiry_date: '2026-01-01' }), doc('new', '8.1')];
    const { tree } = buildIsoCompliance(clauses, docs, [signed('new')], NOW);
    expect(find(tree, '8.1').completion).toBe(100);
  });

  it('cuenta como sin clasificar los documentos sin cláusula, con cláusula inexistente o de punto principal', () => {
    const docs = [doc('a', null), doc('b', '99.9'), doc('c', '8')];
    const { summary, tree } = buildIsoCompliance(clauses, docs, [], NOW);
    expect(summary.unclassifiedDocuments).toBe(3);
    expect(find(tree, '8').completion).toBe(0);
  });

  it('expone el conteo de documentos y firmas por cláusula', () => {
    const { tree } = buildIsoCompliance(clauses, [doc('a', '7.1.1'), doc('b', '7.1.1')], [signed('a')], NOW);
    expect(find(tree, '7.1.1').docCount).toBe(2);
    expect(find(tree, '7.1.1').signedCount).toBe(1);
    expect(find(tree, '7.1').docCount).toBe(2);
  });
});

describe('buildDocumentStats', () => {
  it('cuenta estados, firmados y firmas pendientes del usuario', () => {
    const docs = [
      doc('a', '8.1'),
      doc('b', '8.1', { expiry_date: '2026-10-05' }),
      doc('c', '8.1', { expiry_date: '2026-01-01' }),
      doc('d', '8.1', { status: 'en_revision' }),
      doc('e', '8.1', { status: 'archivado' }),
    ];
    const stats = buildDocumentStats(docs, [signed('a'), pending('d', 'me'), pending('d', 'other')], 'me', NOW);
    expect(stats).toMatchObject({
      total: 5, vigentes: 2, enRevision: 1, vencidos: 1, archivados: 1,
      porVencer: 1, firmados: 1, sinFirma: 4, firmasPendientes: 2, pendientesParaMi: 1,
    });
  });
});

describe('firmas', () => {
  it('sha256 es determinista', () => {
    expect(sha256(Buffer.from('hola'))).toBe(sha256(Buffer.from('hola')));
    expect(sha256(Buffer.from('hola'))).not.toBe(sha256(Buffer.from('hola!')));
  });

  it('la huella de firma cambia si cambia cualquier dato', () => {
    const base = { documentId: 'd', documentSha256: 'abc', signerId: 'u', signedAt: '2026-09-23T12:00:00.000Z', signerName: 'Ana' };
    const hash = computeSignatureHash(base);
    expect(computeSignatureHash({ ...base })).toBe(hash);
    expect(computeSignatureHash({ ...base, documentSha256: 'abd' })).not.toBe(hash);
    expect(computeSignatureHash({ ...base, signerName: 'Ana B' })).not.toBe(hash);
    expect(computeSignatureHash({ ...base, signedAt: '2026-09-23T12:00:00.001Z' })).not.toBe(hash);
    // mismo instante en otro formato de fecha => misma huella
    expect(computeSignatureHash({ ...base, signedAt: '2026-09-23T12:00:00.000+00:00' })).toBe(hash);
  });
});
