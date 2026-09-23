const express = require('express');
const { authenticate, authorize, blockDemo } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');
const {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole
} = require('../controllers/roleController');

const router = express.Router();

// Crear rol
router.post('/', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), createRole);

// Obtener roles
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), getRoles);

// Obtener rol por ID
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, getRoleById);

// Actualizar rol
router.put('/:id', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, updateRole);

// Eliminar rol
router.delete('/:id', authenticate, blockDemo, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, deleteRole);

module.exports = router;
