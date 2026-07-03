const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');
const {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  downloadDocument,
  viewDocument
} = require('../controllers/documentController');

const router = express.Router();

// Memoria, no disco: en Vercel el filesystem es efímero. El archivo se sube
// directo a Supabase Storage desde el controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), upload.single('file'), createDocument);
router.get('/', authenticate, getDocuments);
router.get('/:id', authenticate, validateObjectId, getDocumentById);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, updateDocument);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), validateObjectId, deleteDocument);
router.get('/:id/download', authenticate, validateObjectId, downloadDocument);
router.get('/:id/view', authenticate, validateObjectId, viewDocument);

module.exports = router;
