const { supabaseAdmin } = require('../config/supabaseClient');
const logger = require('../utils/logger');

const TRAINING_STATUS_TO_DB = { 'Pendiente': 'pendiente', 'En proceso': 'en_proceso', 'Completado': 'completado' };
const TRAINING_STATUS_TO_API = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado' };
const CERT_STATUS_TO_API = { activo: 'Activo', expirado: 'Expirado', revocado: 'Revocado' };

const toApiTraining = (t) => ({
  id: t.id,
  _id: t.id,
  title: t.title,
  module: t.module,
  description: t.description,
  status: TRAINING_STATUS_TO_API[t.status] || t.status,
  progress: t.progress,
  score: t.score,
  startDate: t.start_date,
  completionDate: t.completion_date,
  scheduledDate: t.scheduled_date,
  createdAt: t.created_at,
});

const toApiCertificate = (c) => ({
  id: c.id,
  _id: c.id,
  title: c.title,
  module: c.module,
  score: c.score,
  issueDate: c.issue_date,
  expiryDate: c.expiry_date,
  certificateNumber: c.certificate_number,
  filePath: c.storage_path,
  status: CERT_STATUS_TO_API[c.status] || c.status,
});

// Obtener capacitaciones del usuario actual
const getUserTrainings = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: trainings, error } = await supabaseAdmin
      .from('trainings')
      .select('*')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const stats = {
      completed: trainings.filter(t => t.status === 'completado').length,
      inProgress: trainings.filter(t => t.status === 'en_proceso').length,
      pending: trainings.filter(t => t.status === 'pendiente').length,
      averageScore: 0
    };

    const completedTrainings = trainings.filter(t => t.status === 'completado' && t.score);
    if (completedTrainings.length > 0) {
      stats.averageScore = Math.round(
        completedTrainings.reduce((sum, t) => sum + t.score, 0) / completedTrainings.length
      );
    }

    res.json({
      success: true,
      data: {
        trainings: trainings.map(toApiTraining),
        stats
      }
    });
  } catch (error) {
    logger.error('Error al obtener capacitaciones del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener capacitaciones',
      code: 'GET_TRAININGS_ERROR'
    });
  }
};

// Obtener certificados del usuario actual
const getUserCertificates = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: certificates, error } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'activo')
      .order('issue_date', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: { certificates: certificates.map(toApiCertificate) }
    });
  } catch (error) {
    logger.error('Error al obtener certificados del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener certificados',
      code: 'GET_CERTIFICATES_ERROR'
    });
  }
};

// Actualizar progreso de capacitación
const updateTrainingProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress, status } = req.body;
    const userId = req.user.id;

    const { data: training, error: fetchError } = await supabaseAdmin
      .from('trainings')
      .select('*')
      .eq('id', id)
      .eq('assigned_to', userId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Capacitación no encontrada'
      });
    }

    const updateData = {};

    if (progress !== undefined) {
      updateData.progress = Math.min(100, Math.max(0, progress));
    }

    const willBeCompleted = (updateData.progress ?? training.progress) === 100 && training.status !== 'completado';
    if (willBeCompleted) {
      updateData.status = 'completado';
      updateData.completion_date = new Date().toISOString().slice(0, 10);
      updateData.score = Math.floor(Math.random() * 15) + 85; // Score entre 85-100
    }

    if (status) {
      updateData.status = TRAINING_STATUS_TO_DB[status] || status;
      if (updateData.status === 'en_proceso' && !training.start_date) {
        updateData.start_date = new Date().toISOString().slice(0, 10);
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('trainings')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    if (willBeCompleted) {
      const { error: certError } = await supabaseAdmin
        .from('certificates')
        .insert({
          training_id: updated.id,
          user_id: updated.assigned_to,
          title: updated.title,
          module: updated.module,
          score: updated.score
        });
      if (certError) logger.error('Error al generar certificado automático:', certError);
    }

    res.json({
      success: true,
      data: { training: toApiTraining(updated) }
    });
  } catch (error) {
    logger.error('Error al actualizar progreso de capacitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar capacitación',
      code: 'UPDATE_TRAINING_ERROR'
    });
  }
};

// Descargar certificado. El endpoint devuelve metadatos + URL de descarga (el
// frontend actual solo lee response.data.success, no procesa un blob). Si el
// certificado ya tiene un PDF real en Storage, se expone además una signed URL
// temporal para descargarlo directamente desde el navegador.
const downloadCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: certificate, error } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'activo')
      .maybeSingle();

    if (error) throw error;
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificado no encontrado'
      });
    }

    let signedUrl = null;
    if (certificate.storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from('certificates')
        .createSignedUrl(certificate.storage_path, 60);
      signedUrl = signed?.signedUrl || null;
    }

    res.json({
      success: true,
      data: {
        certificate: {
          _id: certificate.id,
          id: certificate.id,
          title: certificate.title,
          module: certificate.module,
          score: certificate.score,
          issueDate: certificate.issue_date,
          certificateNumber: certificate.certificate_number
        },
        downloadUrl: signedUrl || `/api/trainings/certificates/${certificate.id}/download`
      }
    });
  } catch (error) {
    logger.error('Error al descargar certificado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar certificado',
      code: 'DOWNLOAD_CERTIFICATE_ERROR'
    });
  }
};

module.exports = {
  getUserTrainings,
  getUserCertificates,
  updateTrainingProgress,
  downloadCertificate
};
