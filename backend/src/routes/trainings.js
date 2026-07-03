const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getUserTrainings,
  getUserCertificates,
  updateTrainingProgress,
  downloadCertificate
} = require('../controllers/trainingController');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener capacitaciones del usuario actual
router.get('/', getUserTrainings);

// Obtener certificados del usuario actual
router.get('/certificates', getUserCertificates);

// Actualizar progreso de capacitación
router.put('/:id/progress', updateTrainingProgress);

// Descargar certificado
router.get('/certificates/:id/download', downloadCertificate);

module.exports = router;