const { getIsoCompliance, findNode } = require('../services/isoService');
const { effectiveStatus } = require('../utils/isoStats');
const logger = require('../utils/logger');

const NORM_ID = 'ISO-9001-2015';
const NORM_NAME = 'ISO 9001:2015';

const STATUS_LABEL = { completo: 'Completo', en_progreso: 'En progreso', pendiente: 'Pendiente' };

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

// El cumplimiento se calcula solo a partir de los documentos vinculados a cada cláusula y de sus firmas
// (ver utils/isoStats.js). Ya no se edita a mano: subir o firmar un documento mueve las estadísticas.

// Resumen compacto (lo consumen los tableros de todos los roles).
const getComplianceReport = async (req, res) => {
  try {
    const { tree, summary } = await getIsoCompliance();

    res.json({
      success: true,
      message: 'Reporte de cumplimiento generado',
      data: {
        norm: NORM_NAME,
        timestamp: new Date(),
        completion: {
          overall: summary.overall,
          total: summary.mainClauses,
          completed: summary.mainClausesCompleted,
          inProgress: summary.mainClausesInProgress,
          pending: summary.mainClausesPending,
        },
        requirements: {
          total: summary.requirements,
          completed: summary.requirementsCompleted,
          inProgress: summary.requirementsInProgress,
          pending: summary.requirementsPending,
        },
        unclassifiedDocuments: summary.unclassifiedDocuments,
        clauses: tree.map(node => ({
          number: node.code,
          title: node.title,
          completion: node.completion,
          status: node.status,
          requirements: node.leafCount,
          requirementsCompleted: node.leafCompleted,
          documents: node.docCount,
        })),
      },
    });
  } catch (error) {
    logger.error('Error al generar reporte:', error);
    res.status(500).json({ success: false, message: 'Error al generar reporte', code: 'COMPLIANCE_REPORT_ERROR' });
  }
};

// Norma completa: todas las cláusulas 4 a 10 con su avance.
const getNorm = async (req, res) => {
  try {
    const { tree, summary } = await getIsoCompliance();
    res.json({
      success: true,
      data: {
        norm: { id: NORM_ID, name: NORM_NAME, description: 'Sistemas de gestión de la calidad — Requisitos', clauses: tree, summary },
      },
    });
  } catch (error) {
    logger.error('Error al obtener norma:', error);
    res.status(500).json({ success: false, message: 'Error al obtener norma', code: 'GET_NORM_ERROR' });
  }
};

// Una cláusula con los documentos que la respaldan.
const getClause = async (req, res) => {
  try {
    const { tree, documents, signatures } = await getIsoCompliance();
    const clause = findNode(tree, req.params.clauseId);
    if (!clause) return res.status(404).json({ success: false, message: 'Cláusula no encontrada', code: 'CLAUSE_NOT_FOUND' });

    const codes = new Set();
    const collect = (node) => { codes.add(node.code); node.children.forEach(collect); };
    collect(clause);
    // Documentos vinculados a esta cláusula, a sus subcláusulas o a un ancestro (la evidencia se hereda hacia abajo).
    const ancestors = [];
    let parent = clause.parentCode;
    while (parent) { ancestors.push(parent); parent = findNode(tree, parent)?.parentCode; }
    ancestors.forEach(code => codes.add(code));

    const signed = new Set(signatures.filter(s => s.status === 'firmada').map(s => s.document_id));
    const related = documents
      .filter(d => codes.has(d.clause))
      .map(d => ({ id: d.id, code: d.code, title: d.title, clause: d.clause, status: effectiveStatus(d), signed: signed.has(d.id) }));

    res.json({ success: true, data: { clause, documents: related } });
  } catch (error) {
    logger.error('Error al obtener cláusula:', error);
    res.status(500).json({ success: false, message: 'Error al obtener cláusula', code: 'GET_CLAUSE_ERROR' });
  }
};

// CSV de una cláusula (o de todas si clauseId = "all").
const exportClause = async (req, res) => {
  try {
    const { tree, summary } = await getIsoCompliance();
    const wanted = req.params.clauseId;
    const roots = wanted === 'all' ? tree : [findNode(tree, wanted)].filter(Boolean);
    if (!roots.length) return res.status(404).json({ success: false, message: 'Cláusula no encontrada', code: 'CLAUSE_NOT_FOUND' });

    const lines = [];
    lines.push(['Cláusula', 'Título', 'Estado', 'Cumplimiento %', 'Documentos relacionados', 'Documentos firmados'].map(csvCell).join(','));
    const walk = (node, depth) => {
      lines.push([node.code, `${'  '.repeat(depth)}${node.title}`, STATUS_LABEL[node.status], node.completion, node.docCount, node.signedCount].map(csvCell).join(','));
      node.children.forEach(child => walk(child, depth + 1));
    };
    roots.forEach(root => walk(root, 0));
    lines.push('');
    lines.push([`Cumplimiento global ${NORM_NAME}`, '', '', summary.overall].map(csvCell).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="iso9001-${String(wanted).replace(/[^a-zA-Z0-9.-]/g, '_')}.csv"`);
    res.send(`﻿${lines.join('\n')}`);
  } catch (error) {
    logger.error('Error al exportar cláusula:', error);
    res.status(500).json({ success: false, message: 'Error al exportar cláusula', code: 'EXPORT_CLAUSE_ERROR' });
  }
};

module.exports = {
  getComplianceReport,
  getNorm,
  getClause,
  exportClause,
};
