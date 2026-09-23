const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize, blockDemo } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const {
  getConfiguration,
  updateConfiguration,
  restoreConfiguration,
  resetUserPassword,
  getAuditLogs,
  purgeLogs,
  logoutAllSessions,
  clearCache
} = require('../controllers/adminController');

const router = express.Router();

// Validaciones
const updateConfigValidation = [
  body('settings')
    .isObject()
    .withMessage('settings debe ser un objeto'),
  handleValidationErrors
];

const resetPasswordValidation = [
  body('userId')
    .notEmpty()
    .withMessage('userId es requerido'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener mayúsculas, minúsculas y números'),
  handleValidationErrors
];

const purgeLogsValidation = [
  body('daysOld')
    .isInt({ min: 1 })
    .withMessage('daysOld debe ser un número mayor a 0'),
  handleValidationErrors
];

// Rutas de configuración (solo SUPER_ADMIN)
router.get('/config', authenticate, authorize('SUPER_ADMIN'), getConfiguration);
router.put('/config', authenticate, blockDemo, authorize('SUPER_ADMIN'), updateConfigValidation, updateConfiguration);
router.post('/config/restore', authenticate, blockDemo, authorize('SUPER_ADMIN'), restoreConfiguration);

// Rutas de gestión de usuarios (solo SUPER_ADMIN)
router.put('/users/:id/password', authenticate, blockDemo, authorize('SUPER_ADMIN'), resetPasswordValidation, resetUserPassword);

// Rutas de logs (solo SUPER_ADMIN)
router.get('/logs', authenticate, authorize('SUPER_ADMIN'), getAuditLogs);
router.post('/logs/purge', authenticate, blockDemo, authorize('SUPER_ADMIN'), purgeLogsValidation, purgeLogs);

// Rutas de sesiones (solo SUPER_ADMIN)
router.post('/sessions/logout-all', authenticate, blockDemo, authorize('SUPER_ADMIN'), logoutAllSessions);

// Rutas de sistema (solo SUPER_ADMIN)
router.post('/system/cache/clear', authenticate, blockDemo, authorize('SUPER_ADMIN'), clearCache);

module.exports = router;
