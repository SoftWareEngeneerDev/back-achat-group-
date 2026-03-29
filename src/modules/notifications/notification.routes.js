// ============================================================
// NOTIFICATIONS ROUTES — Notifications in-app
// Plateforme Achats Groupés — Burkina Faso
// ============================================================
// IMPORTANT : /notifications/read-all DOIT être avant
// /notifications/:id/read sinon Express traite "read-all"
// comme un :id param.
// ============================================================

const router = require('express').Router();
const notifService = require('./notification.service');
const { authenticate } = require('../../middleware/auth');
const { success, paginated } = require('../../utils/response');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notifications in-app (push, SMS, email)
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: UC12 — Mes notifications paginées
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Notifications avec compteur non lues }
 */
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { data, total, page, limit } = await notifService.getMyNotifications(req.user.id, req.query);

    // Compteur de non lues
    const unreadCount = data.filter(n => !n.isRead).length;

    return res.status(200).json({
      success: true,
      data,
      unreadCount,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// ⚠️ CORRECTION : read-all AVANT :id/read
/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: UC12 — Marquer toutes les notifications comme lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Toutes notifications marquées comme lues }
 */
router.patch('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    const { count } = await notifService.markAllRead(req.user.id);
    return success(res, { count }, `${count} notification(s) marquée(s) comme lue(s)`);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: UC12 — Marquer une notification comme lue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification marquée comme lue }
 */
router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    await notifService.markRead(req.params.id, req.user.id);
    return success(res, null, 'Notification marquée comme lue');
  } catch (err) { next(err); }
});

module.exports = router;