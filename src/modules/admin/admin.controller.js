// ============================================================
// ADMIN CONTROLLER — Traitement des requêtes HTTP
// Djula Market — Burkina Faso
// ============================================================

const adminService = require('./admin.service');
const { success, paginated } = require('../../utils/response');

class AdminController {

  // ── Fournisseurs ──────────────────────────────────────────

  async getSuppliers(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getSuppliers(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async validateSupplier(req, res, next) {
    try {
      const { approved, reason } = req.body;
      const result = await adminService.validateSupplier(req.params.id, req.user.id, approved, reason);
      return success(res, result, `Fournisseur ${approved ? 'approuvé' : 'rejeté'} avec succès`);
    } catch (err) { next(err); }
  }

  // ── Produits ──────────────────────────────────────────────

  async getPendingProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getPendingProducts(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async validateProduct(req, res, next) {
    try {
      const { approved, reason } = req.body;
      const result = await adminService.validateProduct(req.params.id, req.user.id, approved, reason);
      return success(res, result, `Produit ${approved ? 'approuvé' : 'rejeté'} avec succès`);
    } catch (err) { next(err); }
  }

  // ── Utilisateurs ──────────────────────────────────────────

  async getUsers(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getUsers(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async updateUserStatus(req, res, next) {
    try {
      const { status, reason } = req.body;
      const result = await adminService.updateUserStatus(req.params.id, req.user.id, status, reason);
      return success(res, result, `Statut utilisateur mis à jour : ${status}`);
    } catch (err) { next(err); }
  }

  async updateUserRole(req, res, next) {
    try {
      const { role } = req.body;
      const result = await adminService.updateUserRole(req.params.id, req.user.id, role);
      return success(res, result, `Rôle mis à jour : ${role}`);
    } catch (err) { next(err); }
  }

  // ── Groupes ───────────────────────────────────────────────

  async getGroups(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getGroups(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async closeGroup(req, res, next) {
    try {
      const result = await adminService.closeGroup(req.params.id, req.user.id, req.body.reason);
      return success(res, result, 'Groupe fermé avec succès');
    } catch (err) { next(err); }
  }

  // ── Remboursements ────────────────────────────────────────

  async getPendingRefunds(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getPendingRefunds(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async processRefund(req, res, next) {
    try {
      const result = await adminService.processRefund(req.params.id, req.user.id);
      return success(res, result, 'Remboursement traité avec succès');
    } catch (err) { next(err); }
  }

  // ── Analytics ─────────────────────────────────────────────

  async getDashboard(req, res, next) {
    try {
      const result = await adminService.getDashboard();
      return success(res, result);
    } catch (err) { next(err); }
  }

  async getGroupsAnalytics(req, res, next) {
    try {
      const result = await adminService.getGroupsAnalytics();
      return success(res, result);
    } catch (err) { next(err); }
  }

  async getPaymentsAnalytics(req, res, next) {
    try {
      const result = await adminService.getPaymentsAnalytics();
      return success(res, result);
    } catch (err) { next(err); }
  }

  // ── Monitoring & Audit ────────────────────────────────────

  async getSystemHealth(req, res, next) {
    try {
      const result = await adminService.getSystemHealth();
      return success(res, result);
    } catch (err) { next(err); }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getAuditLogs(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async exportGDPR(req, res, next) {
    try {
      const result = await adminService.exportGDPR(req.user.id);
      return success(res, result, 'Export GDPR initié');
    } catch (err) { next(err); }
  }
}

module.exports = new AdminController();