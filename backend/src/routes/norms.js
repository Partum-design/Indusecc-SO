const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getComplianceReport,
  getNorm,
  getClause,
  exportClause
} = require('../controllers/normController');

const router = express.Router();

// El cumplimiento se calcula automáticamente a partir de los documentos y firmas;
// todos los usuarios activos pueden consultarlo.
router.use(authenticate);

router.get('/compliance-report', getComplianceReport);
router.get('/tree', getNorm);
router.get('/norms', getNorm); // alias histórico
router.get('/clauses/:clauseId', getClause);
router.get('/clauses/:clauseId/export', exportClause);

module.exports = router;
