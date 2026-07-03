const logger = require('../utils/logger');

// Estructura fija de referencia de la norma ISO 9001:2015 (no es dato de
// ejemplo del negocio: es el índice de cláusulas de la norma en sí).
const getNormStructure = () => ({
  id: 'ISO-9001-2015',
  name: 'ISO 9001:2015',
  description: 'Sistemas de gestión de la calidad',
  clauses: [
    {
      id: 'clause-4',
      number: '4',
      title: 'Contexto de la organización',
      completed: 60,
      subclauses: [
        { id: '4.1', title: 'Comprender la organización y su contexto', status: 'completed' },
        { id: '4.2', title: 'Entender las necesidades y expectativas', status: 'in-progress' },
        { id: '4.3', title: 'Determinar el alcance del SGC', status: 'pendiente' },
        { id: '4.4', title: 'SGC y sus procesos', status: 'pendiente' }
      ]
    },
    {
      id: 'clause-5',
      number: '5',
      title: 'Liderazgo',
      completed: 45,
      subclauses: [
        { id: '5.1', title: 'Liderazgo y compromiso', status: 'in-progress' },
        { id: '5.2', title: 'Política de calidad', status: 'pendiente' },
        { id: '5.3', title: 'Roles, responsabilidades y autoridades', status: 'pendiente' }
      ]
    },
    {
      id: 'clause-6',
      number: '6',
      title: 'Planificación',
      completed: 30,
      subclauses: [
        { id: '6.1', title: 'Acciones para abordar riesgos y oportunidades', status: 'pendiente' },
        { id: '6.2', title: 'Objetivos de calidad y planificación', status: 'pendiente' },
        { id: '6.3', title: 'Planificación de los cambios', status: 'pendiente' }
      ]
    },
    {
      id: 'clause-7',
      number: '7',
      title: 'Apoyo',
      completed: 20,
      subclauses: [
        { id: '7.1', title: 'Recursos', status: 'in-progress' },
        { id: '7.2', title: 'Competencia', status: 'pendiente' },
        { id: '7.3', title: 'Toma de conciencia', status: 'pendiente' },
        { id: '7.4', title: 'Comunicación', status: 'pendiente' },
        { id: '7.5', title: 'Información documentada', status: 'pendiente' }
      ]
    },
    {
      id: 'clause-8',
      number: '8',
      title: 'Operación',
      completed: 15,
      subclauses: [
        { id: '8.1', title: 'Planificación y control operacional', status: 'in-progress' },
        { id: '8.2', title: 'Requisitos para productos y servicios', status: 'pendiente' },
        { id: '8.3', title: 'Diseño y desarrollo', status: 'pendiente' },
        { id: '8.4', title: 'Control de procesos suministrados externamente', status: 'pendiente' },
        { id: '8.5', title: 'Producción y provisión del servicio', status: 'pendiente' },
        { id: '8.6', title: 'Liberación de productos y servicios', status: 'pendiente' },
        { id: '8.7', title: 'Control de salidas no conformes', status: 'pendiente' }
      ]
    },
    {
      id: 'clause-9',
      number: '9',
      title: 'Evaluación del desempeño',
      completed: 10,
      subclauses: [
        { id: '9.1', title: 'Seguimiento, medición, análisis y evaluación', status: 'in-progress' },
        { id: '9.2', title: 'Auditoría interna', status: 'pendiente' },
        { id: '9.3', title: 'Revisión por la dirección', status: 'pendiente' }
      ]
    },
    {
      id: 'clause-10',
      number: '10',
      title: 'Mejora',
      completed: 5,
      subclauses: [
        { id: '10.1', title: 'Generalidades', status: 'in-progress' },
        { id: '10.2', title: 'No conformidad y acción correctiva', status: 'pendiente' },
        { id: '10.3', title: 'Mejora continua', status: 'pendiente' }
      ]
    }
  ]
});

// Obtener reporte de cumplimiento ISO
const getComplianceReport = async (req, res) => {
  try {
    const norm = getNormStructure();
    
    const totalClauses = norm.clauses.length;
    const completed = norm.clauses.filter(c => c.completed === 100).length;
    const inProgress = norm.clauses.filter(c => c.completed > 0 && c.completed < 100).length;
    const pending = norm.clauses.filter(c => c.completed === 0).length;
    
    const overallCompletion = Math.round(
      norm.clauses.reduce((sum, c) => sum + c.completed, 0) / totalClauses
    );

    logger.info('Reporte de cumplimiento ISO generado');

    res.json({
      success: true,
      message: 'Reporte de cumplimiento generado',
      data: {
        norm: norm.name,
        timestamp: new Date(),
        completion: {
          overall: overallCompletion,
          total: totalClauses,
          completed,
          inProgress,
          pending
        },
        clauses: norm.clauses.map(c => ({
          number: c.number,
          title: c.title,
          completion: c.completed
        }))
      }
    });
  } catch (error) {
    logger.error('Error al generar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte',
      code: 'COMPLIANCE_REPORT_ERROR'
    });
  }
};

// Obtener norma completa con todas las cláusulas
const getNorm = async (req, res) => {
  try {
    const norm = getNormStructure();

    res.json({
      success: true,
      data: { norm }
    });
  } catch (error) {
    logger.error('Error al obtener norma:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener norma',
      code: 'GET_NORM_ERROR'
    });
  }
};

// Obtener cláusula específica
const getClause = async (req, res) => {
  try {
    const { clauseId } = req.params;
    const norm = getNormStructure();

    const clause = norm.clauses.find(c => c.id === clauseId);
    if (!clause) {
      return res.status(404).json({
        success: false,
        message: 'Cláusula no encontrada',
        code: 'CLAUSE_NOT_FOUND'
      });
    }

    logger.info(`Cláusula obtenida: ${clauseId}`);

    res.json({
      success: true,
      message: 'Cláusula obtenida',
      data: { clause }
    });
  } catch (error) {
    logger.error('Error al obtener cláusula:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cláusula',
      code: 'GET_CLAUSE_ERROR'
    });
  }
};

// Actualizar cláusula
const updateClause = async (req, res) => {
  try {
    const { clauseId } = req.params;
    const { status, completion, notes } = req.body;
    const userId = req.user.id;

    // En producción, esto guardaría en MongoDB
    logger.info(`Cláusula ${clauseId} actualizada por usuario ${userId}`);

    res.json({
      success: true,
      message: 'Cláusula actualizada',
      data: {
        clauseId,
        status,
        completion,
        notes,
        updatedAt: new Date(),
        updatedBy: userId
      }
    });
  } catch (error) {
    logger.error('Error al actualizar cláusula:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cláusula',
      code: 'UPDATE_CLAUSE_ERROR'
    });
  }
};

// Exportar cláusula
const exportClause = async (req, res) => {
  try {
    const { clauseId } = req.params;
    const norm = getNormStructure();

    const clause = norm.clauses.find(c => c.id === clauseId);
    if (!clause) {
      return res.status(404).json({
        success: false,
        message: 'Cláusula no encontrada',
        code: 'CLAUSE_NOT_FOUND'
      });
    }

    const csvContent = `Cláusula ISO 9001:2015\n${clause.number} - ${clause.title}\n\nCompleción: ${clause.completed}%\n\nSubcláusulas:\n${clause.subclauses.map(s => `${s.id},${s.title},${s.status}`).join('\n')}`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="clausula-${clauseId}.csv"`);
    res.send(csvContent);

    logger.info(`Cláusula ${clauseId} exportada`);
  } catch (error) {
    logger.error('Error al exportar cláusula:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar cláusula',
      code: 'EXPORT_CLAUSE_ERROR'
    });
  }
};

module.exports = {
  getComplianceReport,
  getNorm,
  getClause,
  updateClause,
  exportClause
};
