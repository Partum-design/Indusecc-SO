const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validation');
const {
  getMyNotifications,
  getSentNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearRead,
  resend,
  sendManual,
} = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get('/', getMyNotifications);
router.get('/sent', getSentNotifications);
router.post('/read-all', markAllAsRead);
router.delete('/read', clearRead);
router.post('/send', authorize('SUPER_ADMIN', 'ADMIN'), sendManual);

router.patch('/:id/read', validateObjectId, markAsRead);
router.post('/:id/resend', validateObjectId, resend);
router.delete('/:id', validateObjectId, deleteNotification);

module.exports = router;
