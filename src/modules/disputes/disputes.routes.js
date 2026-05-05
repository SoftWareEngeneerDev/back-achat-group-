// ============================================================
// DISPUTES ROUTES — Litiges et réclamations
// Base URL : /api/v1
// ============================================================
const router = require('express').Router();
const { body, param } = require('express-validator');
const controller    = require('./disputes.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const disputeIdParam = param('id').notEmpty().withMessage('ID litige requis');

/**
 * @swagger
 * tags:
 *   name: Disputes
 *   description: ⚖️ Litiges — Réclamations membres/fournisseurs
 */

/**
 * @swagger
 * /disputes:
 *   post:
 *     tags: [Disputes]
 *     summary: Ouvrir un litige
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject    : { type: string, maxLength: 200, example: "Produit non conforme à la description" }
 *               description: { type: string, maxLength: 1000 }
 *               groupId    : { type: string, format: uuid }
 *               orderId    : { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Litige ouvert — admin notifié
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/Dispute' }
 */
router.post('/disputes', authenticate,
  [
    body('subject').notEmpty().trim().isLength({ max: 200 }),
    body('description').notEmpty().trim().isLength({ max: 1000 }),
    body('groupId').optional().isUUID(),
    body('orderId').optional().isUUID(),
  ],
  validate, controller.createDispute.bind(controller)
);

/**
 * @swagger
 * /disputes/me:
 *   get:
 *     tags: [Disputes]
 *     summary: Mes litiges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Liste de mes litiges
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Dispute' }
 */
router.get('/disputes/me', authenticate, controller.getMyDisputes.bind(controller));

/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     tags: [Admin]
 *     summary: Tous les litiges (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, IN_REVIEW, RESOLVED, CLOSED] }
 *     responses:
 *       200: { description: Liste paginée des litiges }
 */
router.get('/admin/disputes', authenticate, requireAdmin, controller.getAllDisputes.bind(controller));

/**
 * @swagger
 * /admin/disputes/{id}/take-charge:
 *   patch:
 *     tags: [Admin]
 *     summary: Prendre en charge un litige (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Litige pris en charge — statut IN_REVIEW }
 *       409: { description: Litige déjà en cours }
 */
router.patch('/admin/disputes/:id/take-charge', authenticate, requireAdmin, [disputeIdParam], validate, controller.takeChargeDispute.bind(controller));

/**
 * @swagger
 * /admin/disputes/{id}/resolve:
 *   patch:
 *     tags: [Admin]
 *     summary: Résoudre un litige (Admin)
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
 *             required: [resolution]
 *             properties:
 *               resolution: { type: string, example: "Remboursement accordé — produit non conforme constaté" }
 *     responses:
 *       200: { description: Litige résolu — membre notifié par SMS et email }
 */
router.patch('/admin/disputes/:id/resolve', authenticate, requireAdmin,
  [disputeIdParam, body('resolution').notEmpty().trim()],
  validate, controller.resolveDispute.bind(controller)
);

module.exports = router;