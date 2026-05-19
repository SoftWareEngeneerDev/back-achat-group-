// ============================================================
// USERS CONTROLLER
// Djula Market — Burkina Faso
// ============================================================

const usersService  = require('./users.service');
const uploadService = require('../upload/upload.service');
const prisma        = require('../../config/database');
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

  /** POST /users/me/avatar — upload vers Cloudinary */
  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) return badRequest(res, 'Aucun fichier reçu');

      // ✅ Upload vers Cloudinary au lieu du disque local
      const urls      = await uploadService.uploadMultipleImages([req.file], 'avatars');
      const avatarUrl = urls[0];

      // Sauvegarder l'URL Cloudinary en base
      await prisma.user.update({
        where: { id: req.user.id },
        data : { avatarUrl },
      });

      return success(res, { avatarUrl }, 'Photo de profil mise à jour');
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

  /** GET /supplier/me */
  async getSupplierProfile(req, res, next) {
    try {
      const supplier = await usersService.getSupplierProfile(req.user.id);
      return success(res, supplier);
    } catch (err) { next(err); }
  }

  /** PUT /supplier/me */
  async updateSupplierProfile(req, res, next) {
    try {
      const supplier = await usersService.updateSupplierProfile(req.user.id, req.body);
      return success(res, supplier, 'Profil mis à jour avec succès');
    } catch (err) { next(err); }
  }

  /** POST /supplier/me/logo */
  async uploadSupplierLogo(req, res, next) {
    try {
      if (!req.file) return badRequest(res, 'Aucun fichier reçu');
      const result = await usersService.uploadSupplierLogo(req.user.id, req.file, uploadService);
      return success(res, result, 'Logo mis à jour');
    } catch (err) { next(err); }
  }

  /** POST /supplier/me/documents */
  async uploadSupplierDocuments(req, res, next) {
    try {
      if (!req.files || req.files.length === 0) return badRequest(res, 'Aucun fichier reçu');
      const result = await usersService.uploadSupplierDocuments(req.user.id, req.files, uploadService);
      return success(res, result, `${result.urls.length} document(s) ajouté(s)`);
    } catch (err) { next(err); }
  }

  /** DELETE /supplier/me/documents */
  async deleteSupplierDocument(req, res, next) {
    try {
      const { url } = req.body;
      if (!url) return badRequest(res, 'URL du document requis');
      const result = await usersService.deleteSupplierDocument(req.user.id, url);
      return success(res, result, 'Document supprimé');
    } catch (err) { next(err); }
  }

  /** POST /supplier/withdrawal */
  async createWithdrawalRequest(req, res, next) {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!supplier) {
        const err = new Error('Profil fournisseur introuvable');
        err.status = 404; throw err;
      }

      const { amount, method, accountInfo } = req.body;
      const withdrawal = await prisma.withdrawalRequest.create({
        data: {
          supplierId : supplier.id,
          amount     : parseFloat(amount),
          method,
          accountInfo: accountInfo.trim(),
          status     : 'PENDING',
        },
      });

      return created(res, withdrawal, 'Demande de retrait soumise avec succès');
    } catch (err) { next(err); }
  }

  /** GET /supplier/withdrawals */
  async getMyWithdrawalRequests(req, res, next) {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!supplier) {
        return success(res, []);
      }

      const requests = await prisma.withdrawalRequest.findMany({
        where  : { supplierId: supplier.id },
        orderBy: { createdAt: 'desc' },
      });

      return success(res, requests);
    } catch (err) { next(err); }
  }
}

module.exports = new UsersController();