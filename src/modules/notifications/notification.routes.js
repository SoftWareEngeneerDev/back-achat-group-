const router = require('express').Router();
const notifService = require('./notification.service');
const { authenticate } = require('../../middleware/auth');
const { success, paginated } = require('../../utils/response');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Gestion des notifications in-app
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Liste des notifications de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications paginées
 */
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { data, total, page, limit } = await notifService.getMyNotifications(req.user.id, req.query);
    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

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
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification lue
 */
router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    await notifService.markRead(req.params.id, req.user.id);
    return success(res, null, 'Notification marquée comme lue');
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marquer toutes les notifications comme lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toutes les notifications lues
 */
router.patch('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    await notifService.markAllRead(req.user.id);
    return success(res, null, 'Toutes les notifications marquées comme lues');
  } catch (err) { next(err); }
});

module.exports = router;
