// ============================================================
// ADMIN CONTROLLER — Traitement des requêtes HTTP
// Plateforme Achats Groupés — Burkina Faso
// ============================================================
// Rôle : reçoit les requêtes, appelle le service, renvoie la réponse.
// Ne contient PAS de logique métier — tout est dans admin.service.js
// ============================================================

const adminService = require('./admin.service');
const { success, paginated } = require('../../utils/response');

class AdminController {

  // ──────────────────────────────────────────────────────────
  // FOURNISSEURS
  // ──────────────────────────────────────────────────────────

  /** GET /admin/suppliers — Liste des fournisseurs (filtrés par statut) */
  async getSuppliers(req, res, next) {
    try {
      const result = await adminService.getSuppliers(req.query);
      return paginated(res, result.data, result.page, result.limit, result.total);
    } catch (err) { next(err); }
  }

  /** PATCH /admin/suppliers/:id/validate — Valider ou rejeter un fournisseur */
  async validateSupplier(req, res, next) {
    try {
      const { approved, reason } = req.body;
      const result = await adminService.validateSupplier(
        req.params.id,
        req.user.id,
        approved,
        reason,
      );
      return success(res, result, `Fournisseur ${approved ? 'approuvé' : 'rejeté'} avec succès`);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // PRODUITS
  // ──────────────────────────────────────────────────────────

  /** GET /admin/products/pending — Produits en attente de validation */
  async getPendingProducts(req, res, next) {
    try {
      const result = await adminService.getPendingProducts(req.query);
      return paginated(res, result.data, result.page, result.limit, result.total);
    } catch (err) { next(err); }
  }

  /** PATCH /admin/products/:id/validate — Approuver ou rejeter un produit */
  async validateProduct(req, res, next) {
    try {
      const { approved, reason } = req.body;
      const result = await adminService.validateProduct(
        req.params.id,
        req.user.id,
        approved,
        reason,
      );
      return success(res, result, `Produit ${approved ? 'approuvé' : 'rejeté'} avec succès`);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // UTILISATEURS
  // ──────────────────────────────────────────────────────────

  /** GET /admin/users — Liste paginée de tous les utilisateurs */
  async getUsers(req, res, next) {
    try {
      const result = await adminService.getUsers(req.query);
      return paginated(res, result.data, result.page, result.limit, result.total);
    } catch (err) { next(err); }
  }

  /** PATCH /admin/users/:id/status — Suspendre, bannir ou réactiver un compte */
  async updateUserStatus(req, res, next) {
    try {
      const { status, reason } = req.body;
      const result = await adminService.updateUserStatus(
        req.params.id,
        req.user.id,
        status,
        reason,
      );
      return success(res, result, `Statut utilisateur mis à jour : ${status}`);
    } catch (err) { next(err); }
  }

  /** PUT /admin/users/:id/role — Modifier le rôle d'un utilisateur */
  async updateUserRole(req, res, next) {
    try {
      const { role } = req.body;
      const result = await adminService.updateUserRole(
        req.params.id,
        req.user.id,
        role,
      );
      return success(res, result, `Rôle mis à jour : ${role}`);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // GROUPES
  // ──────────────────────────────────────────────────────────

  /** GET /admin/groups — Liste paginée de tous les groupes */
  async getGroups(req, res, next) {
    try {
      const result = await adminService.getGroups(req.query);
      return paginated(res, result.data, result.page, result.limit, result.total);
    } catch (err) { next(err); }
  }

  /** PATCH /admin/groups/:id/close — Fermer un groupe prématurément */
  async closeGroup(req, res, next) {
    try {
      const { reason } = req.body;
      const result = await adminService.closeGroup(
        req.params.id,
        req.user.id,
        reason,
      );
      return success(res, result, 'Groupe fermé avec succès');
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // REMBOURSEMENTS
  // ──────────────────────────────────────────────────────────

  /** GET /admin/refunds — Liste des paiements en attente de remboursement */
  async getPendingRefunds(req, res, next) {
    try {
      const result = await adminService.getPendingRefunds(req.query);
      return paginated(res, result.data, result.page, result.limit, result.total);
    } catch (err) { next(err); }
  }

  /** POST /admin/refunds/:id/process — Traiter un remboursement */
  async processRefund(req, res, next) {
    try {
      const result = await adminService.processRefund(req.params.id, req.user.id);
      return success(res, result, 'Remboursement traité avec succès');
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // ANALYTICS
  // ──────────────────────────────────────────────────────────

  /** GET /admin/analytics/dashboard — KPIs globaux */
  async getDashboard(req, res, next) {
    try {
      const result = await adminService.getDashboard();
      return success(res, result, 'Dashboard chargé');
    } catch (err) { next(err); }
  }

  /** GET /admin/analytics/groups — Statistiques groupes 30 jours */
  async getGroupsAnalytics(req, res, next) {
    try {
      const result = await adminService.getGroupsAnalytics();
      return success(res, result);
    } catch (err) { next(err); }
  }

  /** GET /admin/analytics/payments — Statistiques paiements */
  async getPaymentsAnalytics(req, res, next) {
    try {
      const result = await adminService.getPaymentsAnalytics();
      return success(res, result);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // MONITORING & AUDIT
  // ──────────────────────────────────────────────────────────

  /** GET /admin/system/health — État de santé du système */
  async getSystemHealth(req, res, next) {
    try {
      const result = await adminService.getSystemHealth();
      return success(res, result);
    } catch (err) { next(err); }
  }

  /** GET /admin/audit-logs — Historique des actions admin */
  async getAuditLogs(req, res, next) {
    try {
      const result = await adminService.getAuditLogs(req.query);
      return paginated(res, result.data, result.page, result.limit, result.total);
    } catch (err) { next(err); }
  }

  /** POST /admin/backup/export — Export GDPR */
  async exportGDPR(req, res, next) {
    try {
      const result = await adminService.exportGDPR(req.user.id);
      return success(res, result, 'Export GDPR initié');
    } catch (err) { next(err); }
  }
}

module.exports = new AdminController();