const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const {
  PORT,
  CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  NODE_ENV
} = require('./config/environment');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const registrationRoutes = require('./routes/registration');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audits');
const findingRoutes = require('./routes/findings');
const calendarRoutes = require('./routes/calendars');
const documentRoutes = require('./routes/documents');
const roleRoutes = require('./routes/roles');
const adminRoutes = require('./routes/admin');
const normRoutes = require('./routes/norms');
const riskRoutes = require('./routes/risks');
const actionRoutes = require('./routes/actions');
const metricsRoutes = require('./routes/metrics');
const trainingRoutes = require('./routes/trainings');

const app = express();

// Seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (CORS_ORIGIN.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin)) return true;
  return false;
};

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/findings', findingRoutes);
app.use('/api/calendars', calendarRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/norms', normRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/trainings', trainingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando correctamente',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    code: 'NOT_FOUND'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error inesperado:', err);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
      code: 'TOKEN_EXPIRED'
    });
  }

  res.status(500).json({
    success: false,
    message: NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
    code: 'SERVER_ERROR'
  });
});

if (require.main === module && NODE_ENV !== 'test') {
  app.listen(PORT, () => logger.info(`Backend iniciado en puerto ${PORT}`));
}

module.exports = app
