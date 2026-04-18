// users.controller.js
const usersService = require('./users.service');
const { success, created, paginated, notFound, error } = require('../../utils/response');

class UsersController {
  async getProfile(req, res, next) {
    try {
      const user = await usersService.getProfile(req.user.id);
      if (!user) return notFound(res, 'Utilisateur');
      return success(res, user);
    } catch (err) { next(err); }
  }

  async updateProfile(req, res, next) {
    try {
      const user = await usersService.updateProfile(req.user.id, req.body);
      return success(res, user, 'Profil mis à jour');
    } catch (err) { next(err); }
  }

  async deleteAccount(req, res, next) {
    try {
      await usersService.deleteAccount(req.user.id);
      return success(res, null, 'Compte supprimé (GDPR)');
    } catch (err) { next(err); }
  }

  async getMyGroups(req, res, next) {
    try {
      const { data, total, page, limit } = await usersService.getMyGroups(req.user.id, req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async getHistory(req, res, next) {
    try {
      const { data, total, page, limit } = await usersService.getHistory(req.user.id, req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  // Admin
  async listUsers(req, res, next) {
    try {
      const { data, total, page, limit } = await usersService.listUsers(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async updateUserStatus(req, res, next) {
    try {
      const user = await usersService.updateUserStatus(req.params.id, req.body.status, req.user.id);
      return success(res, user, 'Statut mis à jour');
    } catch (err) { next(err); }
  }

  async updateUserRole(req, res, next) {
    try {
      const user = await usersService.updateUserRole(req.params.id, req.body.role, req.user.id);
      return success(res, user, 'Rôle mis à jour');
    } catch (err) { next(err); }
  }
}

module.exports = new UsersController();
