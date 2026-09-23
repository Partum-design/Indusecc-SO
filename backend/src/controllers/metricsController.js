const { supabaseAdmin } = require('../config/supabaseClient');
const { getIsoCompliance } = require('../services/isoService');
const logger = require('../utils/logger');

// Obtener indicadores generales del colaborador
const getCollaboratorIndicators = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const [
      { data: actions, error: actionsError },
      { data: documents, error: documentsError },
      { data: audits, error: auditsError },
      { data: findings, error: findingsError },
      iso
    ] = await Promise.all([
      supabaseAdmin.from('actions').select('status, updated_at').eq('assigned_to', userId),
      supabaseAdmin.from('documents').select('expiry_date'),
      supabaseAdmin.from('audits').select('status'),
      supabaseAdmin.from('findings').select('status'),
      getIsoCompliance()
    ]);

    if (actionsError) throw actionsError;
    if (documentsError) throw documentsError;
    if (auditsError) throw auditsError;
    if (findingsError) throw findingsError;

    const completedActions = actions.filter(a => a.status === 'cerrada').length;
    const totalActions = actions.length;
    const pendingActions = totalActions - completedActions;

    const activeDocuments = documents.filter(d => {
      if (!d.expiry_date) return true;
      return new Date(d.expiry_date) > currentDate;
    }).length;
    const totalDocuments = documents.length;

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    const monthlyCompletedActions = actions.filter(a =>
      a.status === 'cerrada' &&
      new Date(a.updated_at) >= monthStart &&
      new Date(a.updated_at) <= monthEnd
    ).length;

    // "completada" es el estado real de cierre en el enum audit_status
    // (el código Mongoose original comparaba contra 'Cerrada', que nunca
    // existió en el enum de Audit y por eso completedAudits siempre daba 0).
    const completedAudits = audits.filter(a => a.status === 'completada').length;
    const resolvedFindings = findings.filter(f => f.status === 'cerrado').length;

    // Cumplimiento SGC = avance real de la norma ISO 9001:2015 (documentos vinculados a cada
    // requisito y firmados), no una mezcla de contadores sin relación entre sí.
    const sgcCompliance = iso.summary.overall;

    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    const lastMonthCompletedActions = actions.filter(a =>
      a.status === 'cerrada' &&
      new Date(a.updated_at) >= lastMonthStart &&
      new Date(a.updated_at) <= lastMonthEnd
    ).length;
    const trend = monthlyCompletedActions - lastMonthCompletedActions;

    res.json({
      success: true,
      data: {
        indicators: {
          sgcCompliance: {
            value: `${sgcCompliance}%`,
            label: 'Cumplimiento SGC',
            trend: `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend)}%`,
            trendType: trend > 0 ? 'up' : 'down',
            percentage: sgcCompliance
          },
          activeDocuments: {
            value: activeDocuments,
            label: 'Docs Vigentes',
            trend: 'Total',
            trendType: 'neutral',
            percentage: totalDocuments > 0 ? Math.round((activeDocuments / totalDocuments) * 100) : 0
          },
          completedTasks: {
            value: `${monthlyCompletedActions}/${totalActions}`,
            label: 'Tareas Completadas',
            trend: new Date().toLocaleString('es-ES', { year: 'numeric', month: 'short' }),
            trendType: 'neutral',
            percentage: totalActions > 0 ? Math.round((monthlyCompletedActions / totalActions) * 100) : 0
          },
          completedAudits: {
            value: `${completedAudits}/${audits.length}`,
            label: 'Auditorías',
            trend: new Date().toLocaleString('es-ES', { year: 'numeric', month: 'short' }),
            trendType: 'neutral',
            percentage: audits.length > 0 ? Math.round((completedAudits / audits.length) * 100) : 0
          }
        },
        summary: {
          pendingActions,
          completedActions,
          totalActions,
          monthlyCompleted: monthlyCompletedActions
        }
      }
    });
  } catch (error) {
    logger.error('Error al obtener indicadores del colaborador:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener indicadores',
      code: 'GET_INDICATORS_ERROR'
    });
  }
};

// Cumplimiento por cláusula ISO: avance documental real (documentos vinculados y firmados)
// más los hallazgos abiertos/cerrados de cada punto de la norma.
const getComplianceByClause = async (req, res) => {
  try {
    const [{ tree }, { data: findings, error }] = await Promise.all([
      getIsoCompliance(),
      supabaseAdmin.from('findings').select('clause, status')
    ]);
    if (error) throw error;

    const findingsByMain = new Map();
    findings.forEach(finding => {
      const main = String(finding.clause || '').split('.')[0];
      if (!main) return;
      const entry = findingsByMain.get(main) || { total: 0, resolved: 0 };
      entry.total += 1;
      if (finding.status === 'cerrado') entry.resolved += 1;
      findingsByMain.set(main, entry);
    });

    const complianceData = tree.map(node => {
      const f = findingsByMain.get(node.code) || { total: 0, resolved: 0 };
      return {
        clause: node.code,
        label: `Cl. ${node.code} — ${node.title}`,
        compliance: node.completion,
        requirements: node.leafCount,
        requirementsCompleted: node.leafCompleted,
        documents: node.docCount,
        totalFindings: f.total,
        resolvedFindings: f.resolved,
        color: node.completion >= 90 ? '#16A34A' : node.completion >= 50 ? '#F59E0B' : '#DC2626'
      };
    });

    res.json({
      success: true,
      data: { compliance: complianceData }
    });
  } catch (error) {
    logger.error('Error al obtener cumplimiento por cláusula:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cumplimiento',
      code: 'GET_COMPLIANCE_ERROR'
    });
  }
};

// Obtener indicadores de proceso
const getProcessIndicators = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString();
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).toISOString();

    const [
      { data: actions, error: actionsError },
      { data: findings, error: findingsError }
    ] = await Promise.all([
      supabaseAdmin.from('actions').select('status').gte('created_at', monthStart).lte('created_at', monthEnd),
      supabaseAdmin.from('findings').select('status').gte('created_at', monthStart).lte('created_at', monthEnd)
    ]);

    if (actionsError) throw actionsError;
    if (findingsError) throw findingsError;

    const completedActions = actions.filter(a => a.status === 'cerrada').length;
    const totalActions = actions.length;

    const resolvedFindings = findings.filter(f => f.status === 'cerrado').length;

    const efficiency = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 85;
    const rejectionRate = findings.length > 0 ? Math.round(((findings.length - resolvedFindings) / findings.length) * 100) : 2;
    const planCompliance = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 90;
    const cycleTime = efficiency > 90 ? 4.2 : efficiency > 80 ? 4.8 : 5.2;

    const indicators = [
      {
        name: 'Eficiencia de Producción',
        target: '≥ 90%',
        result: `${efficiency}%`,
        trend: efficiency >= 90 ? '↑ +2.1%' : '↓ -1.5%',
        trendType: efficiency >= 90 ? 'up' : 'down',
        status: efficiency >= 90 ? 'b-ok' : 'b-warn'
      },
      {
        name: 'Tasa de Rechazos',
        target: '≤ 2%',
        result: `${rejectionRate}%`,
        trend: rejectionRate <= 2 ? '↓ -0.3%' : '↑ +0.5%',
        trendType: rejectionRate <= 2 ? 'up' : 'down',
        status: rejectionRate <= 2 ? 'b-ok' : 'b-warn'
      },
      {
        name: 'Cumplimiento de Plan',
        target: '≥ 95%',
        result: `${planCompliance}%`,
        trend: planCompliance >= 95 ? '↑ +1.2%' : '↓ -3.2%',
        trendType: planCompliance >= 95 ? 'up' : 'down',
        status: planCompliance >= 95 ? 'b-ok' : 'b-warn'
      },
      {
        name: 'Tiempo de Ciclo',
        target: '≤ 4.5 h',
        result: `${cycleTime} h`,
        trend: cycleTime <= 4.5 ? '↓ -0.2 h' : '↑ +0.3 h',
        trendType: cycleTime <= 4.5 ? 'up' : 'down',
        status: cycleTime <= 4.5 ? 'b-ok' : 'b-warn'
      }
    ];

    res.json({ success: true, data: { indicators } });
  } catch (error) {
    logger.error('Error al obtener indicadores de proceso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener indicadores de proceso',
      code: 'GET_PROCESS_INDICATORS_ERROR'
    });
  }
};

// Obtener desempeño del usuario
const getUserPerformance = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const [
      { data: userActions, error: actionsError },
      { data: userDocuments, error: documentsError },
      { data: userTrainings, error: trainingsError }
    ] = await Promise.all([
      supabaseAdmin.from('actions').select('status, created_at').eq('assigned_to', userId),
      supabaseAdmin.from('documents').select('id').eq('uploaded_by', userId),
      supabaseAdmin.from('trainings').select('status').eq('assigned_to', userId)
    ]);

    if (actionsError) throw actionsError;
    if (documentsError) throw documentsError;
    if (trainingsError) throw trainingsError;

    const monthlyActions = userActions.filter(a =>
      new Date(a.created_at) >= monthStart &&
      new Date(a.created_at) <= monthEnd
    );
    const completedMonthly = monthlyActions.filter(a => a.status === 'cerrada').length;

    // Datos reales (antes eran valores simulados/aleatorios): documentos
    // subidos por el usuario y capacitaciones asignadas/completadas.
    const docsReviewed = userDocuments.length;
    const docsTarget = Math.max(docsReviewed, 10);

    const capacitationsCompleted = userTrainings.filter(t => t.status === 'completado').length;
    const capacitationsTarget = Math.max(userTrainings.length, capacitationsCompleted, 1);

    const onTimeTasks = completedMonthly;
    const totalMonthlyTasks = monthlyActions.length;

    const performance = [
      {
        label: 'Procedimientos revisados',
        value: `${docsReviewed}/${docsTarget}`,
        percentage: docsTarget > 0 ? Math.round((docsReviewed / docsTarget) * 100) : 0,
        color: '#16A34A'
      },
      {
        label: 'Capacitaciones',
        value: `${capacitationsCompleted}/${capacitationsTarget}`,
        percentage: capacitationsTarget > 0 ? Math.round((capacitationsCompleted / capacitationsTarget) * 100) : 0,
        color: '#3B82F6'
      },
      {
        label: 'Tareas a tiempo',
        value: `${onTimeTasks}/${totalMonthlyTasks || 1}`,
        percentage: totalMonthlyTasks > 0 ? Math.round((onTimeTasks / totalMonthlyTasks) * 100) : 0,
        color: '#F59E0B'
      }
    ];

    res.json({ success: true, data: { performance } });
  } catch (error) {
    logger.error('Error al obtener desempeño del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener desempeño',
      code: 'GET_PERFORMANCE_ERROR'
    });
  }
};

module.exports = {
  getCollaboratorIndicators,
  getComplianceByClause,
  getProcessIndicators,
  getUserPerformance
};
