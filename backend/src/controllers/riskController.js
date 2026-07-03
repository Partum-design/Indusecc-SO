const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

const toApiRisk = (r) => ({
  id: r.id,
  _id: r.id,
  title: r.title,
  description: r.description,
  process: r.process,
  probability: r.probability,
  impact: r.impact,
  owner: r.owner,
  control: r.control,
  score: r.score,
  cause: r.cause,
  action: r.action,
  level: r.level,
  status: r.status,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  // Aliases en español usados por las vistas de colaborador/consultor
  riesgo: r.description,
  proceso: r.process,
  probabilidad: r.probability,
  impacto: r.impact,
  responsable: r.owner,
  nivel: r.level,
  estado: r.status,
  accion: r.action,
  causa: r.cause,
});

const getRisks = async (req, res) => {
  try {
    const { data: risks, error } = await supabaseAdmin
      .from('risks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = risks.map(toApiRisk);
    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (error) {
    logger.error('Error al obtener riesgos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener riesgos' });
  }
};

const createRisk = async (req, res) => {
  try {
    const {
      description, process, probability, impact, owner, control, score,
      cause, action, level, status, title
    } = req.body;

    const { data: risk, error } = await supabaseAdmin
      .from('risks')
      .insert({
        description: description || title,
        process,
        probability,
        impact,
        owner,
        control,
        score,
        cause,
        action,
        level,
        status: status || 'activo',
        created_by: req.user?.id
      })
      .select('*')
      .single();

    if (error) throw error;

    logger.info(`Riesgo creado exitosamente: ${risk.description}`);
    res.status(201).json({ success: true, data: toApiRisk(risk) });
  } catch (error) {
    logger.error('Error al crear riesgo:', error);
    res.status(500).json({ success: false, message: 'Error al crear riesgo' });
  }
};

const updateRisk = async (req, res) => {
  try {
    const {
      description, process, probability, impact, owner, control, score,
      cause, action, level, status, title
    } = req.body;

    const updateData = {};
    if (description !== undefined || title !== undefined) updateData.description = description || title;
    if (process !== undefined) updateData.process = process;
    if (probability !== undefined) updateData.probability = probability;
    if (impact !== undefined) updateData.impact = impact;
    if (owner !== undefined) updateData.owner = owner;
    if (control !== undefined) updateData.control = control;
    if (score !== undefined) updateData.score = score;
    if (cause !== undefined) updateData.cause = cause;
    if (action !== undefined) updateData.action = action;
    if (level !== undefined) updateData.level = level;
    if (status !== undefined) updateData.status = status;

    const { data: risk, error } = await supabaseAdmin
      .from('risks')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!risk) {
      return res.status(404).json({ success: false, message: 'Riesgo no encontrado' });
    }

    logger.info(`Riesgo actualizado: ${risk.description}`);
    res.json({ success: true, data: toApiRisk(risk) });
  } catch (error) {
    logger.error('Error al actualizar riesgo:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar riesgo' });
  }
};

const deleteRisk = async (req, res) => {
  try {
    const { data: risk, error } = await supabaseAdmin
      .from('risks')
      .delete()
      .eq('id', req.params.id)
      .select('description')
      .maybeSingle();

    if (error) throw error;
    if (!risk) {
      return res.status(404).json({ success: false, message: 'Riesgo no encontrado' });
    }

    logger.info(`Riesgo eliminado: ${risk.description}`);
    res.json({ success: true, message: 'Riesgo eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar riesgo' });
  }
};

module.exports = { getRisks, createRisk, updateRisk, deleteRisk };
