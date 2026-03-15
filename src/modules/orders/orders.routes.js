const router = require('express').Router();
const { body } = require('express-validator');
const ordersService = require('./orders.service');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');
const { success, paginated } = require('../../utils/response');
const { validate } = require('../../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Gestion des commandes et expéditions
 */

/**
 * @swagger
 * /orders/me:
 *   get:
 *     tags: [Orders]
 *     summary: Liste des commandes de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des commandes
 */
router.get('/orders/me', authenticate, async (req, res, next) => {
  try { return success(res, await ordersService.getMyOrders(req.user.id)); } catch (e) { next(e); }
});

/**
 * @swagger
 * /orders/{id}/tracking:
 *   get:
 *     tags: [Orders]
 *     summary: Suivi d'une commande spécifique
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Informations de suivi
 */
router.get('/orders/:id/tracking', authenticate, async (req, res, next) => {
  try {
    const tracking = await ordersService.getOrderTracking(req.params.id, req.user.id);
    if (!tracking) return require('../../utils/response').notFound(res, 'Commande');
    return success(res, tracking);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /supplier/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Liste des commandes adressées au fournisseur
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des commandes (paginée)
 */
router.get('/supplier/orders', authenticate, requireSupplier, async (req, res, next) => {
  try {
    const { data, total, page, limit } = await ordersService.getSupplierOrders(req.user.id, req.query);
    return paginated(res, data, page, limit, total);
  } catch (e) { next(e); }
});

/**
 * @swagger
 * /supplier/orders/{id}/confirm:
 *   patch:
 *     tags: [Orders]
 *     summary: Confirmer la prise en charge d'une commande (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Commande confirmée
 */
router.patch('/supplier/orders/:id/confirm', authenticate, requireSupplier, async (req, res, next) => {
  try { return success(res, await ordersService.confirmOrder(req.params.id, req.user.id), 'Commande confirmée'); } catch (e) { next(e); }
});

/**
 * @swagger
 * /supplier/orders/{id}/ship:
 *   patch:
 *     tags: [Orders]
 *     summary: Marquer une commande comme expédiée (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trackingCode]
 *             properties:
 *               trackingCode: { type: string, example: "TRK-123456" }
 *     responses:
 *       200:
 *         description: Commande expédiée
 */
router.patch('/supplier/orders/:id/ship', authenticate, requireSupplier, [
  body('trackingCode').notEmpty(),
], validate, async (req, res, next) => {
  try { return success(res, await ordersService.shipOrder(req.params.id, req.user.id, req.body.trackingCode), 'Commande expédiée'); } catch (e) { next(e); }
});

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Liste globale de toutes les commandes (Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des commandes
 */
router.get('/admin/orders', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { data, total, page, limit } = await ordersService.getAllOrders(req.query);
    return paginated(res, data, page, limit, total);
  } catch (e) { next(e); }
});

module.exports = router;
