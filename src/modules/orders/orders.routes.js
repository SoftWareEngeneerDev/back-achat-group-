// ============================================================
// ORDERS ROUTES — Commandes et expéditions
// Base URL : /api/v1
// ============================================================
const router = require('express').Router();
const { body, param } = require('express-validator');
const controller    = require('./orders.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');

const orderIdParam = param('id').notEmpty().withMessage('ID commande requis');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: 📬 Commandes — Suivi, expédition, livraison
 */

/**
 * @swagger
 * /orders/me:
 *   get:
 *     tags: [Orders]
 *     summary: Mes commandes (membre)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CREATED, PROCESSING, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200:
 *         description: Liste de mes commandes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 */
router.get('/orders/me', authenticate, controller.getMyOrders.bind(controller));

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Détail et suivi d'une commande
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail complet de la commande avec tracking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/Order' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/orders/:id', authenticate, [orderIdParam], validate, controller.getOrderById.bind(controller));

/**
 * @swagger
 * /orders/{id}/confirm-delivery:
 *   patch:
 *     tags: [Orders]
 *     summary: Confirmer la réception d'une commande
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Livraison confirmée — avis produit possible }
 *       409: { description: Commande pas encore expédiée }
 */
router.patch('/orders/:id/confirm-delivery', authenticate, [orderIdParam], validate, controller.confirmDelivery.bind(controller));

/**
 * @swagger
 * /supplier/orders:
 *   get:
 *     tags: [Supplier]
 *     summary: Commandes de mes groupes (fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CREATED, PROCESSING, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200: { description: Commandes du fournisseur }
 */
router.get('/supplier/orders', authenticate, requireSupplier, controller.getSupplierOrders.bind(controller));

/**
 * @swagger
 * /supplier/orders/{id}/confirm:
 *   patch:
 *     tags: [Supplier]
 *     summary: Prendre en charge une commande
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Commande prise en charge }
 */
router.patch('/supplier/orders/:id/confirm', authenticate, requireSupplier, [orderIdParam], validate, controller.confirmOrder.bind(controller));

/**
 * @swagger
 * /supplier/orders/{id}/ship:
 *   patch:
 *     tags: [Supplier]
 *     summary: Marquer une commande comme expédiée
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
 *               trackingCode: { type: string, example: "DHL-BF-2024-48291" }
 *     responses:
 *       200: { description: Commande expédiée — membre notifié }
 */
router.patch('/supplier/orders/:id/ship', authenticate, requireSupplier,
  [orderIdParam, body('trackingCode').notEmpty().trim()], validate,
  controller.shipOrder.bind(controller)
);

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: Toutes les commandes (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [CREATED, PROCESSING, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200: { description: Toutes les commandes paginées }
 */
router.get('/admin/orders', authenticate, requireAdmin, controller.getAllOrders.bind(controller));

/**
 * @swagger
 * /admin/orders/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Forcer le statut d'une commande (Admin)
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [CREATED, PROCESSING, SHIPPED, DELIVERED, CANCELLED] }
 *     responses:
 *       200: { description: Statut mis à jour }
 */
router.patch('/admin/orders/:id/status', authenticate, requireAdmin,
  [orderIdParam, body('status').notEmpty().isIn(['CREATED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])],
  validate, controller.updateOrderStatus.bind(controller)
);

module.exports = router;