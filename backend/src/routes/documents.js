const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');
const {
  createUploadUrl,
  createDocument,
  getDocuments,
  getDocumentById,
  getDocumentStats,
  getDocumentUrl,
  updateDocument,
  deleteDocument,
  verifyDocument,
} = require('../controllers/documentController');
const {
  getSignatures,
  requestSignatures,
  resendSignatureRequest,
  cancelSignatureRequest,
  signDocument,
} = require('../controllers/signatureController');

const router = express.Router();

// Compatibilidad: subida multipart pequeña (en Vercel el cuerpo no puede pasar de 4.5 MB).
// El flujo normal es /upload-url -> subida directa a Storage -> POST / (JSON).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

router.use(authenticate);

// Cualquier usuario activo puede subir, ver y firmar documentos; editar/eliminar/pedir firmas
// se restringe al autor o a un administrador dentro de cada controlador.
router.get('/stats', getDocumentStats);
router.post('/upload-url', createUploadUrl);
router.post('/', upload.single('file'), createDocument);
router.get('/', getDocuments);

router.get('/:id', validateObjectId, getDocumentById);
router.put('/:id', validateObjectId, updateDocument);
router.delete('/:id', validateObjectId, deleteDocument);
router.get('/:id/url', validateObjectId, getDocumentUrl);
router.get('/:id/verify', validateObjectId, verifyDocument);

router.get('/:id/signatures', validateObjectId, getSignatures);
router.post('/:id/signatures/request', validateObjectId, requestSignatures);
router.post('/:id/signatures/:sigId/resend', validateObjectId, resendSignatureRequest);
router.delete('/:id/signatures/:sigId', validateObjectId, cancelSignatureRequest);
router.post('/:id/sign', validateObjectId, signDocument);

module.exports = router;
