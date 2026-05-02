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

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: 🔔 Notifications — Alertes temps réel
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Mes notifications paginées
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Liste paginée des notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Notification' }
 *                 meta: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/notifications',
  authenticate,
  controller.getMyNotifications.bind(controller)
);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marquer toutes les notifications comme lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Toutes les notifications marquées comme lues }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch('/notifications/read-all',
  authenticate,
  controller.markAllRead.bind(controller)
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marquer une notification comme lue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Notification marquée comme lue }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch('/notifications/:id/read',
  authenticate,
  [param('id').notEmpty().withMessage('ID notification requis')],
  validate,
  controller.markRead.bind(controller)
);

module.exports = router;