// ============================================================
// USERS CONTROLLER
// Djula Market — Burkina Faso
// ============================================================

const usersService = require('./users.service');
const { success, created, paginated, badRequest } = require('../../utils/response');

class UsersController {

  /** GET /users/me */
  async getProfile(req, res, next) {
    try {
      const user = await usersService.getProfile(req.user.id);
      return success(res, user);
    } catch (err) { next(err); }
  }

  /** PUT /users/me */
  async updateProfile(req, res, next) {
    try {
      const user = await usersService.updateProfile(req.user.id, req.body);
      return success(res, user, 'Profil mis à jour avec succès');
    } catch (err) { next(err); }
  }

  /** POST /users/me/avatar */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) return badRequest(res, 'Aucun fichier reçu');
      const result = await usersService.uploadAvatar(req.user.id, req.file);
      return created(res, result, 'Photo de profil mise à jour');
    } catch (err) { next(err); }
  }

  /** DELETE /users/me */
  async deleteAccount(req, res, next) {
    try {
      await usersService.deleteAccount(req.user.id);
      return success(res, null, 'Compte supprimé conformément au RGPD');
    } catch (err) { next(err); }
  }

  /** GET /users/me/groups */
  async getMyGroups(req, res, next) {
    try {
      const result = await usersService.getMyGroups(req.user.id);
      return success(res, result);
    } catch (err) { next(err); }
  }

  /** GET /users/me/history */
  async getHistory(req, res, next) {
    try {
      const { data, payments, total, page, limit } = await usersService.getHistory(req.user.id, req.query);
      return paginated(res, { memberships: data, payments }, page, limit, total);
    } catch (err) { next(err); }
  }

  /** GET /users/me/stats */
  async getStats(req, res, next) {
    try {
      const stats = await usersService.getMemberStats(req.user.id);
      return success(res, stats);
    } catch (err) { next(err); }
  }

  /** GET /users/me/notifications */
  async getMyNotifications(req, res, next) {
    try {
      const { data, total, unreadCount, page, limit } = await usersService.getMyNotifications(req.user.id, req.query);
      return paginated(res, { notifications: data, unreadCount }, page, limit, total);
    } catch (err) { next(err); }
  }

  /** PATCH /users/me/notifications/:id/read */
  async markNotificationRead(req, res, next) {
    try {
      await usersService.markNotificationRead(req.params.id, req.user.id);
      return success(res, null, 'Notification marquée comme lue');
    } catch (err) { next(err); }
  }

  /** PATCH /users/me/notifications/read-all */
  async markAllNotificationsRead(req, res, next) {
    try {
      await usersService.markAllNotificationsRead(req.user.id);
      return success(res, null, 'Toutes les notifications marquées comme lues');
    } catch (err) { next(err); }
  }
}

module.exports = new UsersController();