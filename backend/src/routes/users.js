const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize, blockDemo } = require('../middleware/auth');
const { validateObjectId, handleValidationErrors } = require('../middleware/validation');
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getUserStats,
  getUserDirectory,
  updateUserProfile
} = require('../controllers/userController');

const router = express.Router();

// Validaciones
const createUserValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre es requerido'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es requerido')
    .isEmail()
    .withMessage('Email inválido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  body('role')
    .notEmpty()
    .withMessage('El rol es requerido')
    .custom(value => {
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'COLABORADOR', 'CONSULTOR'];
      if (!validRoles.includes(value)) {
        throw new Error(`Rol inválido. Debe ser: ${validRoles.join(', ')}`);
      }
      return true;
    }),
  body('active')
    .optional()
    .isBoolean()
    .withMessage('El campo active debe ser booleano'),
  handleValidationErrors
];

const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'COLABORADOR', 'CONSULTOR'])
    .withMessage('Rol inválido'),
  body('active')
    .optional()
    .isBoolean()
    .withMessage('El campo active debe ser booleano'),
  handleValidationErrors
];

const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100'),
  query('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'ADMIN', 'COLABORADOR', 'CONSULTOR'])
    .withMessage('Rol inválido'),
  query('active')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El campo active debe ser true o false'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('La búsqueda debe tener entre 1 y 100 caracteres'),
  handleValidationErrors
];

// Rutas
router.get('/directory', authenticate, getUserDirectory);
router.get('/stats', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), getUserStats);
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), ...getUsersValidation, getUsers);
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, getUserById);
router.post('/', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), ...createUserValidation, createUser);
router.post('/create', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), ...createUserValidation, createUser);
router.put('/profile', authenticate, blockDemo, updateUserProfile);
router.put('/:id', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, ...updateUserValidation, updateUser);
router.patch('/:id/status', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, toggleUserStatus);
router.delete('/:id', authenticate, blockDemo, authorize('SUPER_ADMIN'), validateObjectId, deleteUser);

module.exports = router;
