const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validateObjectId, handleValidationErrors } = require('../middleware/validation');
const {
  requestRegistration,
  getRegistrationRequests,
  approveRegistration,
  rejectRegistration
} = require('../controllers/registrationController');

const router = express.Router();

// Validaciones
const registrationRequestValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Teléfono inválido'),
  body('requestedRole')
    .optional()
    .isIn(['COLABORADOR', 'CONSULTOR', 'ADMIN'])
    .withMessage('Rol solicitado inválido'),
  handleValidationErrors
];

const approveValidation = [
  body('requestId')
    .notEmpty()
    .withMessage('ID de solicitud requerido'),
  body('approvalNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas no deben exceder 500 caracteres'),
  handleValidationErrors
];

const rejectValidation = [
  body('requestId')
    .notEmpty()
    .withMessage('ID de solicitud requerido'),
  body('rejectionReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La razón de rechazo no debe exceder 500 caracteres'),
  handleValidationErrors
];

// Rutas públicas
router.post('/request', registrationRequestValidation, requestRegistration);

// Rutas administrativas (solo SUPER_ADMIN y ADMIN pueden ver y gestionar)
router.get('/requests', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), getRegistrationRequests);

router.post('/approve', 
  authenticate, 
  authorize('SUPER_ADMIN', 'ADMIN'), 
  approveValidation, 
  approveRegistration
);

router.post('/reject', 
  authenticate, 
  authorize('SUPER_ADMIN', 'ADMIN'), 
  rejectValidation, 
  rejectRegistration
);

module.exports = router;
