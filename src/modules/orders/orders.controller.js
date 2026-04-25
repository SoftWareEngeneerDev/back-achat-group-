// ============================================================
// ORDERS CONTROLLER — Traitement des requêtes HTTP
// Djula Market — Burkina Faso
// ============================================================

const ordersService = require('./orders.service');
const { success, paginated } = require('../../utils/response');

class OrdersController {

  // ── Membre ────────────────────────────────────────────────

  /** GET /orders/me */
  async getMyOrders(req, res, next) {
    try {
      const orders = await ordersService.getMyOrders(req.user.id);
      return success(res, orders);
    } catch (err) { next(err); }
  }

  /** GET /orders/:id */
  async getOrderById(req, res, next) {
    try {
      const order = await ordersService.getOrderById(req.params.id, req.user.id);
      return success(res, order);
    } catch (err) { next(err); }
  }

  /** PATCH /orders/:id/confirm-delivery */
  async confirmDelivery(req, res, next) {
    try {
      const order = await ordersService.confirmDelivery(req.params.id, req.user.id);
      return success(res, order, 'Réception confirmée — paiement fournisseur en cours de libération');
    } catch (err) { next(err); }
  }

  // ── Fournisseur ───────────────────────────────────────────

  /** GET /supplier/orders */
  async getSupplierOrders(req, res, next) {
    try {
      const { data, total, page, limit } = await ordersService.getSupplierOrders(req.user.id, req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  /** PATCH /supplier/orders/:id/confirm */
  async confirmOrder(req, res, next) {
    try {
      const order = await ordersService.confirmOrder(req.params.id, req.user.id);
      return success(res, order, 'Commande confirmée — membres notifiés');
    } catch (err) { next(err); }
  }

  /** PATCH /supplier/orders/:id/ship */
  async shipOrder(req, res, next) {
    try {
      const { trackingCode } = req.body;
      const order = await ordersService.shipOrder(req.params.id, req.user.id, trackingCode);
      return success(res, order, 'Commande marquée comme expédiée — membres notifiés');
    } catch (err) { next(err); }
  }

  // ── Admin ─────────────────────────────────────────────────

  /** GET /admin/orders */
  async getAllOrders(req, res, next) {
    try {
      const { data, total, page, limit } = await ordersService.getAllOrders(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  /** PATCH /admin/orders/:id/status */
  async updateOrderStatus(req, res, next) {
    try {
      const order = await ordersService.updateOrderStatus(req.params.id, req.body.status);
      return success(res, order, 'Statut de la commande mis à jour');
    } catch (err) { next(err); }
  }
}

module.exports = new OrdersController();