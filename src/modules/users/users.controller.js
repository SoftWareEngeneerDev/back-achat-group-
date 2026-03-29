// ============================================================
// USERS CONTROLLER — Traitement des requêtes HTTP
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const usersService = require('./users.service');
const { success, paginated, notFound } = require('../../utils/response');

class UsersController {

  // ──────────────────────────────────────────────────────────
  // PROFIL UTILISATEUR CONNECTÉ
  // ──────────────────────────────────────────────────────────

  /** GET /users/me — Profil de l'utilisateur connecté */
  async getProfile(req, res, next) {
    try {
      const user = await usersService.getProfile(req.user.id);
      if (!user) return notFound(res, 'Utilisateur');
      return success(res, user);
    } catch (err) { next(err); }
  }

  /** PUT /users/me — Mettre à jour son profil */
  async updateProfile(req, res, next) {
    try {
      const user = await usersService.updateProfile(req.user.id, req.body);
      return success(res, user, 'Profil mis à jour avec succès');
    } catch (err) { next(err); }
  }

  /** DELETE /users/me — Supprimer son compte (GDPR) */
  async deleteAccount(req, res, next) {
    try {
      await usersService.deleteAccount(req.user.id);
      return success(res, null, 'Compte supprimé conformément au RGPD');
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD UTILISATEUR
  // ──────────────────────────────────────────────────────────

  /** GET /users/me/groups — Dashboard "Mes Groupes" */
  async getMyGroups(req, res, next) {
    try {
      const groups = await usersService.getMyGroups(req.user.id);
      return success(res, groups);
    } catch (err) { next(err); }
  }

  /** GET /users/me/history — Historique des achats */
  async getHistory(req, res, next) {
    try {
      const { data, payments, total, page, limit } = await usersService.getHistory(req.user.id, req.query);
      return paginated(res, { memberships: data, payments }, page, limit, total);
    } catch (err) { next(err); }
  }

  /** GET /users/me/notifications — Mes notifications */
  async getMyNotifications(req, res, next) {
    try {
      const { data, total, unreadCount, page, limit } = await usersService.getMyNotifications(req.user.id, req.query);
      return paginated(res, { notifications: data, unreadCount }, page, limit, total);
    } catch (err) { next(err); }
  }

  /** PATCH /users/me/notifications/:id/read — Marquer une notif comme lue */
  async markNotificationRead(req, res, next) {
    try {
      await usersService.markNotificationRead(req.params.id, req.user.id);
      return success(res, null, 'Notification marquée comme lue');
    } catch (err) { next(err); }
  }

  /** PATCH /users/me/notifications/read-all — Tout marquer comme lu */
  async markAllNotificationsRead(req, res, next) {
    try {
      await usersService.markAllNotificationsRead(req.user.id);
      return success(res, null, 'Toutes les notifications marquées comme lues');
    } catch (err) { next(err); }
  }
}

module.exports = new UsersController();