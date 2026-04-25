// ============================================================
// NOTIFICATIONS ROUTES
// Djula Market — Burkina Faso
// Base URL : /api/v1/notifications
// ⚠️ read-all DOIT être déclaré AVANT /:id/read
// ============================================================

const router = require('express').Router();
const { param } = require('express-validator');

const controller   = require('./notification.controller');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

// GET /notifications — Mes notifications paginées
router.get('/notifications',
  authenticate,
  controller.getMyNotifications.bind(controller)
);

// PATCH /notifications/read-all ← AVANT /:id/read
router.patch('/notifications/read-all',
  authenticate,
  controller.markAllRead.bind(controller)
);

// PATCH /notifications/:id/read
router.patch('/notifications/:id/read',
  authenticate,
  [param('id').notEmpty().withMessage('ID notification requis')],
  validate,
  controller.markRead.bind(controller)
);

module.exports = router;