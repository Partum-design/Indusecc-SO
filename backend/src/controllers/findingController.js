const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');
const sendEmail = require('../utils/email');

const SEVERITY_TO_DB = {
  critical: 'critica', high: 'alta', medium: 'media', low: 'baja',
  'Crítica': 'critica', 'Alta': 'alta', 'Media': 'media', 'Baja': 'baja'
};
const SEVERITY_FROM_DB = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };

const STATUS_TO_DB = { 'Abierto': 'abierto', 'En Revisión': 'en_revision', 'Cerrado': 'cerrado' };
const STATUS_FROM_DB = { abierto: 'Abierto', en_revision: 'En Revisión', cerrado: 'Cerrado' };
const VALID_STATUSES = Object.keys(STATUS_TO_DB);

const RISK_LEVEL_FROM_DB = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto', critico: 'Crítico' };
const RISK_LEVEL_TO_DB = { 'Bajo': 'bajo', 'Medio': 'medio', 'Alto': 'alto', 'Crítico': 'critico' };

const SELECT_WITH_JOINS = `*,
  reported_by_profile:profiles!findings_reported_by_fkey(id, name, email),
  assigned_to_profile:profiles!findings_assigned_to_fkey(id, name, email),
  audit:audits(id, title)`;

const toApiFinding = (row) => ({
  id: row.id,
  _id: row.id,
  title: row.title,
  description: row.description,
  severity: SEVERITY_FROM_DB[row.severity] || row.severity,
  status: STATUS_FROM_DB[row.status] || row.status,
  reportedBy: row.reported_by_profile
    ? { _id: row.reported_by_profile.id, id: row.reported_by_profile.id, name: row.reported_by_profile.name, email: row.reported_by_profile.email }
    : row.reported_by,
  assignedTo: row.assigned_to_profile
    ? { _id: row.assigned_to_profile.id, id: row.assigned_to_profile.id, name: row.assigned_to_profile.name, email: row.assigned_to_profile.email }
    : row.assigned_to,
  audit: row.audit ? { _id: row.audit.id, id: row.audit.id, title: row.audit.title } : row.audit_id,
  area: row.area,
  clause: row.clause,
  riskLevel: RISK_LEVEL_FROM_DB[row.risk_level] || row.risk_level,
  relatedDocument: row.related_document,
  findingDate: row.finding_date,
  immediateAction: row.immediate_action,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const canAccessFinding = (user, finding) => {
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'CONSULTOR') return true;
  if (user.role === 'COLABORADOR') return finding.reported_by === user.id || finding.assigned_to === user.id;
  return false;
};

const createFinding = async (req, res) => {
  try {
    const {
      title, description, severity, assignedTo, audit, area, clause,
      riskLevel, relatedDocument, findingDate, immediateAction
    } = req.body;

    const { data: finding, error } = await supabaseAdmin
      .from('findings')
      .insert({
        title,
        description,
        severity: SEVERITY_TO_DB[severity] || 'media',
        assigned_to: assignedTo || null,
        audit_id: audit || null,
        reported_by: req.user.id,
        area,
        clause,
        risk_level: riskLevel ? (RISK_LEVEL_TO_DB[riskLevel] || riskLevel.toLowerCase()) : null,
        related_document: relatedDocument,
        finding_date: findingDate || null,
        immediate_action: immediateAction
      })
      .select('*')
      .single();

    if (error) throw error;

    try {
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('name, email')
        .in('role', ['admin', 'super_admin'])
        .eq('active', true);

      if (admins?.length) {
        const reporterName = req.user.name || req.user.email;
        const findingSeverity = SEVERITY_FROM_DB[finding.severity] || finding.severity;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #9B1C1C; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">Nuevo Hallazgo Reportado</h2>
            <p>Se ha registrado un nuevo hallazgo en la plataforma que requiere revisión.</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #9B1C1C;">
              <p><strong>Título:</strong> ${title}</p>
              <p><strong>Severidad:</strong> <span style="color: #c62828; font-weight: bold;">${findingSeverity}</span></p>
              <p><strong>Área:</strong> ${area || 'No especificada'}</p>
              <p><strong>Reportado por:</strong> ${reporterName}</p>
              <p><strong>Descripción:</strong> ${description || 'Sin descripción'}</p>
            </div>
            <p>Por favor, ingresa al panel de administración para gestionar este hallazgo.</p>
            <hr />
            <p style="font-size: 0.7em; color: #999;">Indusecc SGC - Sistema de Gestión de Calidad</p>
          </div>
        `;

        for (const admin of admins) {
          if (admin.email) {
            await sendEmail({
              email: admin.email,
              subject: `⚠️ Nuevo Hallazgo: ${title}`,
              message: `Se ha reportado un nuevo hallazgo de severidad ${findingSeverity} por ${reporterName}.`,
              html
            });
          }
        }
      }
    } catch (err) {
      logger.error('Error al enviar notificaciones de nuevo hallazgo a administradores:', err);
    }

    logger.info(`Hallazgo creado: ${title} por ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Hallazgo creado exitosamente',
      data: { finding: toApiFinding(finding) }
    });
  } catch (error) {
    logger.error('Error al crear hallazgo:', error);
    res.status(500).json({ success: false, message: 'Error al crear hallazgo', code: 'CREATE_FINDING_ERROR' });
  }
};

const getFindings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('findings')
      .select(SELECT_WITH_JOINS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (req.query.status) query = query.eq('status', STATUS_TO_DB[req.query.status] || req.query.status);
    if (req.query.severity) query = query.eq('severity', SEVERITY_TO_DB[req.query.severity] || req.query.severity);
    if (req.query.audit) query = query.eq('audit_id', req.query.audit);
    if (req.query.assignedTo) query = query.eq('assigned_to', req.query.assignedTo);
    if (req.query.search) query = query.or(`title.ilike.%${req.query.search}%,description.ilike.%${req.query.search}%`);

    if (req.user.role === 'COLABORADOR') {
      query = query.or(`reported_by.eq.${req.user.id},assigned_to.eq.${req.user.id}`);
    }

    const { data: findings, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Hallazgos obtenidos exitosamente',
      data: {
        findings: findings.map(toApiFinding),
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) }
      }
    });
  } catch (error) {
    logger.error('Error al obtener hallazgos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener hallazgos', code: 'GET_FINDINGS_ERROR' });
  }
};

const getFindingById = async (req, res) => {
  try {
    const { data: finding, error } = await supabaseAdmin
      .from('findings')
      .select(SELECT_WITH_JOINS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!finding) {
      return res.status(404).json({ success: false, message: 'Hallazgo no encontrado', code: 'FINDING_NOT_FOUND' });
    }

    if (!canAccessFinding(req.user, finding)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para ver este hallazgo', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    res.json({ success: true, message: 'Hallazgo obtenido exitosamente', data: { finding: toApiFinding(finding) } });
  } catch (error) {
    logger.error('Error al obtener hallazgo:', error);
    res.status(500).json({ success: false, message: 'Error al obtener hallazgo', code: 'GET_FINDING_ERROR' });
  }
};

const updateFinding = async (req, res) => {
  try {
    const { title, description, severity, assignedTo, status } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('findings').select('reported_by, assigned_to').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hallazgo no encontrado', code: 'FINDING_NOT_FOUND' });
    }

    if ((req.user.role === 'CONSULTOR' || req.user.role === 'COLABORADOR') &&
        existing.reported_by !== req.user.id && existing.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para actualizar este hallazgo', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (severity !== undefined) updateData.severity = SEVERITY_TO_DB[severity] || severity;
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Estado inválido', code: 'INVALID_STATUS' });
      }
      updateData.status = STATUS_TO_DB[status];
    }

    const { data: finding, error } = await supabaseAdmin
      .from('findings')
      .update(updateData)
      .eq('id', req.params.id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    logger.info(`Hallazgo actualizado: ${finding.title} por ${req.user.email}`);

    res.json({ success: true, message: 'Hallazgo actualizado exitosamente', data: { finding: toApiFinding(finding) } });
  } catch (error) {
    logger.error('Error al actualizar hallazgo:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar hallazgo', code: 'UPDATE_FINDING_ERROR' });
  }
};

const deleteFinding = async (req, res) => {
  try {
    const { data: finding, error: fetchError } = await supabaseAdmin
      .from('findings').select('id, title, reported_by').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!finding) {
      return res.status(404).json({ success: false, message: 'Hallazgo no encontrado', code: 'FINDING_NOT_FOUND' });
    }

    if ((req.user.role === 'CONSULTOR' || req.user.role === 'COLABORADOR') && finding.reported_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar este hallazgo', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const { error } = await supabaseAdmin.from('findings').delete().eq('id', req.params.id);
    if (error) throw error;

    logger.info(`Hallazgo eliminado: ${finding.title} por ${req.user.email}`);

    res.json({ success: true, message: 'Hallazgo eliminado exitosamente', data: { deletedFinding: { id: finding.id, title: finding.title } } });
  } catch (error) {
    logger.error('Error al eliminar hallazgo:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar hallazgo', code: 'DELETE_FINDING_ERROR' });
  }
};

const updateFindingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido', code: 'INVALID_STATUS' });
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('findings').select('reported_by, assigned_to').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hallazgo no encontrado', code: 'FINDING_NOT_FOUND' });
    }

    if ((req.user.role === 'CONSULTOR' || req.user.role === 'COLABORADOR') &&
        existing.reported_by !== req.user.id && existing.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para cambiar el estado de este hallazgo', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const { data: finding, error } = await supabaseAdmin
      .from('findings')
      .update({ status: STATUS_TO_DB[status] })
      .eq('id', req.params.id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    logger.info(`Estado de hallazgo cambiado: ${finding.title} -> ${status} por ${req.user.email}`);

    res.json({ success: true, message: 'Estado actualizado exitosamente', data: { finding: toApiFinding(finding) } });
  } catch (error) {
    logger.error('Error al cambiar estado de hallazgo:', error);
    res.status(500).json({ success: false, message: 'Error al cambiar estado de hallazgo', code: 'UPDATE_FINDING_STATUS_ERROR' });
  }
};

const assignFinding = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('findings').select('reported_by').eq('id', req.params.id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Hallazgo no encontrado', code: 'FINDING_NOT_FOUND' });
    }

    if (req.user.role === 'CONSULTOR' && existing.reported_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para asignar este hallazgo', code: 'INSUFFICIENT_PERMISSIONS' });
    }

    const { data: finding, error } = await supabaseAdmin
      .from('findings')
      .update({ assigned_to: assignedTo || null })
      .eq('id', req.params.id)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) throw error;

    logger.info(`Hallazgo asignado: ${finding.title} -> ${finding.assigned_to_profile?.name || 'Sin asignar'} por ${req.user.email}`);

    res.json({ success: true, message: 'Hallazgo asignado exitosamente', data: { finding: toApiFinding(finding) } });
  } catch (error) {
    logger.error('Error al asignar hallazgo:', error);
    res.status(500).json({ success: false, message: 'Error al asignar hallazgo', code: 'ASSIGN_FINDING_ERROR' });
  }
};

const getFindingStats = async (req, res) => {
  try {
    const statusCounts = {};
    for (const [label, dbValue] of Object.entries(STATUS_TO_DB)) {
      const { count } = await supabaseAdmin.from('findings').select('id', { count: 'exact', head: true }).eq('status', dbValue);
      statusCounts[label] = count || 0;
    }

    const severityCounts = {};
    for (const [dbValue, label] of Object.entries(SEVERITY_FROM_DB)) {
      const { count } = await supabaseAdmin.from('findings').select('id', { count: 'exact', head: true }).eq('severity', dbValue);
      severityCounts[label] = count || 0;
    }

    const { count: totalFindings } = await supabaseAdmin.from('findings').select('id', { count: 'exact', head: true });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentFindings } = await supabaseAdmin.from('findings').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo);

    res.json({
      success: true,
      message: 'Estadísticas de hallazgos obtenidas exitosamente',
      data: {
        totalFindings: totalFindings || 0,
        openFindings: statusCounts['Abierto'],
        inReviewFindings: statusCounts['En Revisión'],
        closedFindings: statusCounts['Cerrado'],
        highSeverityFindings: severityCounts['Alta'],
        recentFindings: recentFindings || 0,
        byStatus: Object.entries(statusCounts).map(([label, count]) => ({ _id: label, count })),
        bySeverity: Object.entries(severityCounts).map(([label, count]) => ({ _id: label, count }))
      }
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de hallazgos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas', code: 'GET_FINDING_STATS_ERROR' });
  }
};

module.exports = {
  createFinding,
  getFindings,
  getFindingById,
  updateFinding,
  deleteFinding,
  updateFindingStatus,
  assignFinding,
  getFindingStats,
};
