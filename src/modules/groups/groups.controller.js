// ============================================================
// GROUPS CONTROLLER — Traitement des requêtes HTTP
// Djula Market — Burkina Faso
// ============================================================

const groupsService = require('./groups.service');
const { success, created, paginated } = require('../../utils/response');

class GroupsController {

  // ── Routes publiques ──────────────────────────────────────

  /** GET /groups */
  async listGroups(req, res, next) {
    try {
      const { data, total, page, limit } = await groupsService.listGroups(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  /** GET /groups/:id */
  async getGroup(req, res, next) {
    try {
      const group = await groupsService.getGroup(req.params.id);
      return success(res, group);
    } catch (err) { next(err); }
  }

  /** GET /groups/:id/progress */
  async getGroupProgress(req, res, next) {
    try {
      const progress = await groupsService.getGroupProgress(req.params.id);
      return success(res, progress);
    } catch (err) { next(err); }
  }

  // ── Routes membre ─────────────────────────────────────────

  /**
   * POST /groups/:id/join
   * Étape 1 — Vérifier les conditions + retourner le montant du dépôt.
   * Le membre est confirmé APRÈS paiement via confirmJoinAfterDeposit.
   */
  async joinGroup(req, res, next) {
    try {
      const result = await groupsService.joinGroup(req.params.id, req.user.id);
      return success(res, result, 'Procédez au paiement du dépôt pour rejoindre le groupe');
    } catch (err) { next(err); }
  }

  /** DELETE /groups/:id/leave */
  async leaveGroup(req, res, next) {
    try {
      const result = await groupsService.leaveGroup(req.params.id, req.user.id);
      return success(res, result, 'Participation annulée — dépôt en cours de remboursement');
    } catch (err) { next(err); }
  }

  // ── Routes fournisseur ────────────────────────────────────

  /** POST /supplier/groups */

  async getMyGroups(req, res, next) {
    try {
      const { data, total, page, limit } = await groupsService.getMyGroups(req.user.id, req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async createGroup(req, res, next) {
    try {
      const group = await groupsService.createGroup(req.user.id, req.body, false);
      return created(res, group, 'Groupe créé avec succès');
    } catch (err) { next(err); }
  }

  /** PUT /supplier/groups/:id */
  async updateGroup(req, res, next) {
    try {
      const group = await groupsService.updateGroup(req.params.id, req.user.id, req.body, false);
      return success(res, group, 'Groupe mis à jour — membres notifiés');
    } catch (err) { next(err); }
  }

  /** PATCH /supplier/groups/:id/close */
  async closeGroup(req, res, next) {
    try {
      const result = await groupsService.closeGroup(req.params.id, req.user.id, req.body.reason);
      return success(res, result, 'Groupe annulé — membres notifiés');
    } catch (err) { next(err); }
  }

  // ── Routes admin ──────────────────────────────────────────

  /** POST /admin/groups */
  async createGroupAdmin(req, res, next) {
    try {
      const group = await groupsService.createGroup(req.user.id, req.body, true);
      return created(res, group, 'Groupe créé par l\'administration');
    } catch (err) { next(err); }
  }

  /** PUT /admin/groups/:id */
  async updateGroupAdmin(req, res, next) {
    try {
      const group = await groupsService.updateGroup(req.params.id, req.user.id, req.body, true);
      return success(res, group, 'Groupe mis à jour par l\'administration');
    } catch (err) { next(err); }
  }
}

module.exports = new GroupsController();