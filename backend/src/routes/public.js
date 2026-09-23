const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { getIsoCompliance } = require('../services/isoService');
const { buildDocumentStats } = require('../utils/isoStats');
const logger = require('../utils/logger');

const router = express.Router();

// Solo agregados (conteos y porcentajes): nada identificable. Alimenta las cifras de la pantalla de login.
router.get('/stats', async (_req, res) => {
  try {
    const [iso, { count: audits, error }] = await Promise.all([
      getIsoCompliance(),
      supabaseAdmin.from('audits').select('id', { count: 'exact', head: true }),
    ]);
    if (error) throw error;

    const docs = buildDocumentStats(iso.documents, iso.signatures);
    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      success: true,
      data: {
        documentsActive: docs.vigentes,
        documentsTotal: docs.total,
        compliance: iso.summary.overall,
        audits: audits || 0,
      },
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas públicas:', error);
    res.status(500).json({ success: false, message: 'No se pudieron obtener las estadísticas', code: 'PUBLIC_STATS_ERROR' });
  }
});

module.exports = router;
