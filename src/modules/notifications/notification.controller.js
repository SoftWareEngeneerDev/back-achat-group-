// ============================================================
// NOTIFICATION CONTROLLER — Traitement des requêtes HTTP
// Djula Market — Burkina Faso
// ============================================================

const notifService = require('./notification.service');
const { success, paginated } = require('../../utils/response');

class NotificationController {

  /** GET /notifications */
  async getMyNotifications(req, res, next) {
    try {
      const { data, total, unreadCount, page, limit } =
        await notifService.getMyNotifications(req.user.id, req.query);
      return paginated(res, { notifications: data, unreadCount }, page, limit, total);
    } catch (err) { next(err); }
  }

  /** PATCH /notifications/read-all */
  async markAllRead(req, res, next) {
    try {
      const { count } = await notifService.markAllRead(req.user.id);
      return success(res, { count }, `${count} notification(s) marquée(s) comme lue(s)`);
    } catch (err) { next(err); }
  }

  /** PATCH /notifications/:id/read */
  async markRead(req, res, next) {
    try {
      await notifService.markRead(req.params.id, req.user.id);
      return success(res, null, 'Notification marquée comme lue');
    } catch (err) { next(err); }
  }
}

module.exports = new NotificationController();