// ============================================================
// GROUPS ROUTES — Groupes d'achat
// Base URL : /api/v1
// ============================================================
const router = require('express').Router();
const { body, param } = require('express-validator');
const controller = require('./groups.controller');
const { validate, sanitizeBody }          = require('../../middleware/validate');
const { authenticate, optionalAuth,
        requireAdmin, requireSupplier }   = require('../../middleware/auth');
const { joinGroupLimiter, createLimiter } = require('../../middleware/rateLimit');

const groupIdParam = param('id').notEmpty().withMessage('ID groupe requis');
const pricingTiersValidators = [
  body('pricingTiers').isArray({ min: 1 }).withMessage('Au moins un palier requis'),
  body('pricingTiers.*.participantCount').isInt({ min: 1 }),
  body('pricingTiers.*.discountPercent').isFloat({ min: 1, max: 90 }),
];
const createGroupValidators = [
  body('productId').notEmpty().withMessage('ID produit requis'),
  body('minParticipants').isInt({ min: 2 }),
  body('maxParticipants').isInt({ min: 3 }),
  body('expiresAt').isISO8601(),
  body('depositPercent').optional().isFloat({ min: 0.05, max: 0.5 }),
  ...pricingTiersValidators,
];
const updateGroupValidators = [
  body('expiresAt').optional().isISO8601(),
  body('maxParticipants').optional().isInt({ min: 3 }),
];

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: 🔥 Groupes d'achat — Participation, paliers de prix, progression
 */

/**
 * @swagger
 * /groups:
 *   get:
 *     tags: [Groups]
 *     summary: Liste des groupes d'achat avec filtres
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, THRESHOLD_REACHED, CLOSED, FAILED, CANCELLED] }
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste paginée des groupes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Group' }
 *                 meta: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/groups', optionalAuth, controller.listGroups.bind(controller));

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     tags: [Groups]
 *     summary: Détail d'un groupe avec paliers et membres
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Détail complet du groupe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/Group' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/groups/:id', optionalAuth, [groupIdParam], validate, controller.getGroup.bind(controller));

/**
 * @swagger
 * /groups/{id}/progress:
 *   get:
 *     tags: [Groups]
 *     summary: Progression en temps réel d'un groupe
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Progression du groupe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentCount   : { type: integer, example: 8 }
 *                     minParticipants: { type: integer, example: 10 }
 *                     currentPrice   : { type: number, example: 188600 }
 *                     progressPercent: { type: number, example: 80 }
 *                     nextTier:
 *                       type: object
 *                       properties:
 *                         price      : { type: number }
 *                         participants: { type: integer }
 *                         remaining  : { type: integer }
 */
router.get('/groups/:id/progress', [groupIdParam], validate, controller.getGroupProgress.bind(controller));

/**
 * @swagger
 * /groups/{id}/join:
 *   post:
 *     tags: [Groups]
 *     summary: "Étape 1 — Rejoindre un groupe d'achat"
 *     description: |
 *       Réserve une place dans le groupe. Après cette étape, procéder au paiement du dépôt via POST /payments/deposit.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Place réservée — paiement du dépôt requis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     depositAmount: { type: number, example: 18860 }
 *                     currentPrice : { type: number, example: 188600 }
 *                     message      : { type: string }
 *                     groupId      : { type: string }
 *       409: { description: Groupe complet ou déjà membre }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/groups/:id/join', authenticate, joinGroupLimiter, [groupIdParam], validate, controller.joinGroup.bind(controller));

/**
 * @swagger
 * /groups/{id}/leave:
 *   delete:
 *     tags: [Groups]
 *     summary: Quitter un groupe (avec remboursement du dépôt si applicable)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Groupe quitté
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     refundAmount: { type: number, example: 18860 }
 *       409: { description: Impossible de quitter (seuil atteint ou déjà payé) }
 */
router.delete('/groups/:id/leave', authenticate, [groupIdParam], validate, controller.leaveGroup.bind(controller));

/**
 * @swagger
 * /supplier/groups:
 *   get:
 *     tags: [Supplier]
 *     summary: Mes groupes créés
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, THRESHOLD_REACHED, CLOSED, FAILED, CANCELLED] }
 *     responses:
 *       200: { description: Liste de mes groupes }
 *   post:
 *     tags: [Supplier]
 *     summary: Créer un nouveau groupe d'achat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, minParticipants, maxParticipants, expiresAt, pricingTiers]
 *             properties:
 *               productId      : { type: string, format: uuid }
 *               minParticipants: { type: integer, minimum: 2, example: 10 }
 *               maxParticipants: { type: integer, minimum: 3, example: 50 }
 *               expiresAt      : { type: string, format: date-time }
 *               depositPercent : { type: number, example: 0.1 }
 *               pricingTiers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     participantCount: { type: integer, example: 10 }
 *                     discountPercent : { type: number, example: 35 }
 *     responses:
 *       201: { description: Groupe créé }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.get('/supplier/groups', authenticate, requireSupplier, controller.getMyGroups.bind(controller));
router.post('/supplier/groups', authenticate, requireSupplier, createLimiter, sanitizeBody, createGroupValidators, validate, controller.createGroup.bind(controller));

/**
 * @swagger
 * /supplier/groups/{id}:
 *   put:
 *     tags: [Supplier]
 *     summary: Modifier un groupe (avant seuil atteint)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresAt      : { type: string, format: date-time }
 *               maxParticipants: { type: integer }
 *     responses:
 *       200: { description: Groupe mis à jour }
 */
router.put('/supplier/groups/:id', authenticate, requireSupplier, [groupIdParam, ...updateGroupValidators], validate, controller.updateGroup.bind(controller));

router.patch('/supplier/groups/:id/close',
  authenticate, requireSupplier,
  [
    groupIdParam,
    body('reason').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  controller.closeGroup.bind(controller)
);

/**
 * @swagger
 * /admin/groups:
 *   post:
 *     tags: [Admin]
 *     summary: Créer un groupe manuellement (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, minParticipants, maxParticipants, expiresAt, pricingTiers]
 *             properties:
 *               productId      : { type: string, format: uuid }
 *               minParticipants: { type: integer }
 *               maxParticipants: { type: integer }
 *               expiresAt      : { type: string, format: date-time }
 *               pricingTiers   : { type: array }
 *     responses:
 *       201: { description: Groupe créé par admin }
 */
router.post('/admin/groups', authenticate, requireAdmin, sanitizeBody, createGroupValidators, validate, controller.createGroupAdmin.bind(controller));

/**
 * @swagger
 * /admin/groups/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Modifier n'importe quel groupe (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Groupe mis à jour }
 */
router.put('/admin/groups/:id', authenticate, requireAdmin, [groupIdParam, ...updateGroupValidators], validate, controller.updateGroupAdmin.bind(controller));

module.exports = router;