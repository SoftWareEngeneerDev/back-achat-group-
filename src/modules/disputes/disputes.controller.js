// ============================================================
// DISPUTES CONTROLLER
// Djula Market — Burkina Faso
// ============================================================

const disputesService = require('./disputes.service');
const { success, created, paginated } = require('../../utils/response');

class DisputesController {

  async createDispute(req, res, next) {
    try {
      const dispute = await disputesService.createDispute(req.user.id, req.body);
      return created(res, dispute, 'Litige ouvert avec succès');
    } catch (err) { next(err); }
  }

  async getMyDisputes(req, res, next) {
    try {
      const disputes = await disputesService.getMyDisputes(req.user.id);
      return success(res, disputes);
    } catch (err) { next(err); }
  }

  async getAllDisputes(req, res, next) {
    try {
      const { data, total, page, limit } = await disputesService.getAllDisputes(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async takeChargeDispute(req, res, next) {
    try {
      const dispute = await disputesService.takeChargeDispute(req.params.id, req.user.id);
      return success(res, dispute, 'Litige pris en charge');
    } catch (err) { next(err); }
  }

  async resolveDispute(req, res, next) {
    try {
      const dispute = await disputesService.resolveDispute(
        req.params.id, req.user.id, req.body.resolution
      );
      return success(res, dispute, 'Litige résolu — utilisateur notifié');
    } catch (err) { next(err); }
  }
}

module.exports = new DisputesController();