const { validationResult } = require('express-validator');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateObjectId = (req, res, next) => {
  if (!UUID_REGEX.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'ID inválido',
      code: 'INVALID_ID'
    });
  }
  next();
};

const requireFields = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter(field =>
      req.body[field] === undefined ||
      req.body[field] === null ||
      (typeof req.body[field] === 'string' && req.body[field].trim() === '')
    );
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Faltan campos obligatorios: ${missing.join(', ')}`,
        code: 'MISSING_FIELDS',
        details: missing
      });
    }
    next();
  };
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    
    console.log('[VALIDATION ERROR] Details:', JSON.stringify(errorDetails, null, 2));
    console.log('[VALIDATION ERROR] Body received:', JSON.stringify(req.body, null, 2));
    
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      code: 'VALIDATION_ERROR',
      details: errorDetails
    });
  }
  next();
};

module.exports = {
  validateObjectId,
  requireFields,
  handleValidationErrors,
};
