// ============================================================
// ADMIN CONTROLLER — Traitement des requêtes HTTP
// Djula Market — Burkina Faso
// ============================================================

const adminService = require('./admin.service');
const { success, paginated } = require('../../utils/response');

class AdminController {

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
      return success(res, result, `Statut mis à jour : ${status}`);
    } catch (err) { next(err); }
  }

  async updateUserRole(req, res, next) {
    try {
      const result = await adminService.updateUserRole(req.params.id, req.user.id, req.body.role);
      return success(res, result, `Rôle mis à jour : ${req.body.role}`);
    } catch (err) { next(err); }
  }

  // ── Fournisseurs ───────────────────────────────────────────
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
      return success(res, result, `Fournisseur ${approved ? 'approuvé' : 'rejeté'}`);
    } catch (err) { next(err); }
  }

  // ── Produits ───────────────────────────────────────────────


  async getProductById(req, res, next) {
    try {
      const product = await adminService.getProductById(req.params.id);
      return success(res, product);
    } catch (err) { next(err); }
  }

  async getGroupById(req, res, next) {
    try {
      const group = await adminService.getGroupById(req.params.id);
      return success(res, group);
    } catch (err) { next(err); }
  }

  async getAllProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getAllProducts(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

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
      return success(res, result, `Produit ${approved ? 'approuvé' : 'rejeté'}`);
    } catch (err) { next(err); }
  }

  // ── Groupes ────────────────────────────────────────────────
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

  // ── Litiges ────────────────────────────────────────────────
  async getDisputes(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getDisputes(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async takeChargeDispute(req, res, next) {
    try {
      const result = await adminService.takeChargeDispute(req.params.id, req.user.id);
      return success(res, result, 'Litige pris en charge');
    } catch (err) { next(err); }
  }

  async resolveDispute(req, res, next) {
    try {
      const result = await adminService.resolveDispute(req.params.id, req.user.id, req.body.resolution);
      return success(res, result, 'Litige résolu — membre notifié');
    } catch (err) { next(err); }
  }

  // ── Remboursements ─────────────────────────────────────────
  async getPendingRefunds(req, res, next) {
    try {
      const { data, total, page, limit } = await adminService.getPendingRefunds(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async processRefund(req, res, next) {
    try {
      const result = await adminService.processRefund(req.params.id, req.user.id);
      return success(res, result, 'Remboursement traité');
    } catch (err) { next(err); }
  }

  async refundPayment(req, res, next) {
    try {
      const result = await adminService.processRefund(req.body.paymentId, req.user.id);
      return success(res, result, 'Remboursement effectué');
    } catch (err) { next(err); }
  }

  // ── Analytics ──────────────────────────────────────────────
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

  // ── Monitoring ─────────────────────────────────────────────
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