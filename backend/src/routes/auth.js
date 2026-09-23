const express = require('express')
const rateLimit = require('express-rate-limit')
const { loginUser, refreshSession, demoLogin, demoStatus, uploadFile, registerUser, forgotPassword, resetPassword } = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// Intentos de inicio de sesión: más estricto que el limitador general de la API.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { success: false, message: 'Demasiados intentos de inicio de sesión, intenta más tarde.', code: 'LOGIN_RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/login', loginLimiter, loginUser)
router.post('/refresh', refreshSession)
router.get('/demo-status', demoStatus)
router.post('/demo-login', loginLimiter, demoLogin)
router.post('/register', registerUser)
router.post('/forgot-password', loginLimiter, forgotPassword)
router.post('/reset-password/:token', resetPassword)
router.post('/upload', authenticate, uploadFile)

module.exports = router
