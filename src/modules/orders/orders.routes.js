// ============================================================
// ORDERS ROUTES — Commandes et expéditions
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const ordersService = require('./orders.service');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');
const { success, paginated, notFound } = require('../../utils/response'); // ← CORRECTION : import en haut
const { validate } = require('../../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Commandes groupées et suivi de livraison
 */

// ============================================================
// MEMBRE — Ses commandes (UC16)
// ============================================================

/**
 * @swagger
 * /orders/me:
 *   get:
 *     tags: [Orders]
 *     summary: UC16 — Mes commandes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Liste des commandes de l'utilisateur }
 */
router.get('/orders/me', authenticate, async (req, res, next) => {
  try {
    return success(res, await ordersService.getMyOrders(req.user.id));
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /orders/{id}/tracking:
 *   get:
 *     tags: [Orders]
 *     summary: UC16 — Suivi d'une commande
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Statut et code de suivi }
 *       404: { description: Commande introuvable }
 */
router.get('/orders/:id/tracking', authenticate, async (req, res, next) => {
  try {
    const tracking = await ordersService.getOrderTracking(req.params.id, req.user.id);
    return success(res, tracking);
  } catch (err) { next(err); }
});

// ============================================================
// FOURNISSEUR — Gestion de ses commandes (UC25)
// ============================================================

/**
 * @swagger
 * /supplier/orders:
 *   get:
 *     tags: [Orders]
 *     summary: UC25 — Mes commandes à traiter (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CREATED, PROCESSING, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200: { description: Commandes paginées du fournisseur }
 */
router.get('/supplier/orders', authenticate, requireSupplier, async (req, res, next) => {
  try {
    const { data, total, page, limit } = await ordersService.getSupplierOrders(req.user.id, req.query);
    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /supplier/orders/{id}/confirm:
 *   patch:
 *     tags: [Orders]
 *     summary: UC25 — Confirmer la prise en charge d'une commande
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Commande en PROCESSING, membres notifiés }
 *       409: { description: Commande déjà confirmée }
 */
router.patch('/supplier/orders/:id/confirm', authenticate, requireSupplier, async (req, res, next) => {
  try {
    return success(res, await ordersService.confirmOrder(req.params.id, req.user.id), 'Commande confirmée');
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /supplier/orders/{id}/ship:
 *   patch:
 *     tags: [Orders]
 *     summary: UC25 — Marquer une commande comme expédiée
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trackingCode]
 *             properties:
 *               trackingCode: { type: string, example: "TRK-BF-2026-001" }
 *     responses:
 *       200: { description: Commande SHIPPED, membres notifiés avec code de suivi }
 *       409: { description: Commande pas encore en traitement }
 */
router.patch(
  '/supplier/orders/:id/ship',
  authenticate,
  requireSupplier,
  [
    body('trackingCode').notEmpty().withMessage('Code de suivi requis'),
  ],
  validate,
  async (req, res, next) => {
    try {
      return success(
        res,
        await ordersService.shipOrder(req.params.id, req.user.id, req.body.trackingCode),
        'Commande expédiée, membres notifiés',
      );
    } catch (err) { next(err); }
  },
);

// ============================================================
// ADMIN — Toutes les commandes
// ============================================================

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Liste globale de toutes les commandes (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CREATED, PROCESSING, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200: { description: Toutes les commandes paginées }
 */
router.get('/admin/orders', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { data, total, page, limit } = await ordersService.getAllOrders(req.query);
    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

module.exports = router;