// ============================================================
// GROUPS ROUTES — Groupes d'achat
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./groups.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');
const { joinGroupLimiter, createLimiter } = require('../../middleware/rateLimit'); // ← AJOUT

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Groupes d'achat — tarification dynamique et participations
 */

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

/**
 * @swagger
 * /groups:
 *   get:
 *     tags: [Groups]
 *     summary: UC3 — Liste des groupes actifs avec filtres
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, THRESHOLD_REACHED, CLOSED, FAILED], default: OPEN }
 *       - in: query
 *         name: productId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste paginée des groupes }
 */
router.get('/groups', controller.listGroups.bind(controller));

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     tags: [Groups]
 *     summary: UC4 — Détail d'un groupe (paliers prix, membres anonymisés)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Détail complet du groupe }
 *       404: { description: Groupe introuvable }
 */
router.get('/groups/:id', controller.getGroup.bind(controller));

/**
 * @swagger
 * /groups/{id}/progress:
 *   get:
 *     tags: [Groups]
 *     summary: Progression en temps réel du groupe
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Progression, % complétion, places restantes }
 */
router.get('/groups/:id/progress', controller.getGroupProgress.bind(controller));

// ============================================================
// ROUTES MEMBRE
// ============================================================

/**
 * @swagger
 * /groups/{id}/join:
 *   post:
 *     tags: [Groups]
 *     summary: UC8 — Rejoindre un groupe (retourne le montant du dépôt à payer)
 *     description: |
 *       Étape 1 du flow de participation.
 *       Retourne le montant du dépôt à payer via CinetPay.
 *       Le membre est confirmé après paiement du dépôt.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Montant du dépôt à payer + instructions }
 *       409: { description: Groupe complet / déjà membre / seuil atteint }
 *       429: { description: Trop de groupes rejoints récemment }
 */
router.post(
  '/groups/:id/join',
  authenticate,
  joinGroupLimiter, // ← AJOUT : max 5 groupes rejoints/heure par userId
  controller.joinGroup.bind(controller),
);

/**
 * @swagger
 * /groups/{id}/leave:
 *   delete:
 *     tags: [Groups]
 *     summary: UC9 — Quitter un groupe (uniquement si statut OPEN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Participation annulée, dépôt remboursé }
 *       409: { description: Impossible après le seuil minimum }
 */
router.delete('/groups/:id/leave', authenticate, controller.leaveGroup.bind(controller));

// ============================================================
// ROUTES FOURNISSEUR
// ============================================================

/**
 * @swagger
 * /supplier/groups:
 *   post:
 *     tags: [Groups]
 *     summary: UC22 — Créer un groupe d'achat (Fournisseur)
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
 *               productId:       { type: string, format: uuid }
 *               title:           { type: string, example: "Groupe Riz 25kg Janvier" }
 *               minParticipants: { type: integer, example: 10 }
 *               maxParticipants: { type: integer, example: 50 }
 *               depositPercent:  { type: number, example: 0.1 }
 *               expiresAt:       { type: string, format: date-time }
 *               pricingTiers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [participantCount, discountPercent]
 *                   properties:
 *                     participantCount: { type: integer, example: 10 }
 *                     discountPercent:  { type: number, example: 10.5 }
 *     responses:
 *       201: { description: Groupe créé et publié (statut OPEN) }
 *       403: { description: Fournisseur non validé }
 *       429: { description: Trop de créations récentes }
 */
router.post(
  '/supplier/groups',
  authenticate,
  requireSupplier,
  createLimiter, // ← AJOUT : max 20 créations/heure par userId
  [
    body('productId').notEmpty().withMessage('ID produit requis'),
    body('minParticipants').isInt({ min: 2 }).withMessage('Minimum 2 participants'),
    body('maxParticipants').isInt({ min: 2 }).withMessage('Maximum invalide'),
    body('expiresAt').isISO8601().withMessage("Date d'expiration invalide"),
    body('depositPercent').optional().isFloat({ min: 0.05, max: 0.5 }),
    body('pricingTiers').isArray({ min: 1 }).withMessage('Au moins un palier de prix requis'),
    body('pricingTiers.*.participantCount').isInt({ min: 1 }),
    body('pricingTiers.*.discountPercent').isFloat({ min: 1, max: 90 }),
  ],
  validate,
  controller.createGroup.bind(controller),
);

/**
 * @swagger
 * /supplier/groups/{id}:
 *   put:
 *     tags: [Groups]
 *     summary: UC23 — Modifier un groupe ouvert (délai, max participants)
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
 *               expiresAt:       { type: string, format: date-time }
 *               maxParticipants: { type: integer }
 *     responses:
 *       200: { description: Groupe mis à jour, membres notifiés }
 *       403: { description: Non autorisé }
 *       409: { description: Groupe non ouvert }
 */
router.put(
  '/supplier/groups/:id',
  authenticate,
  requireSupplier,
  [
    body('expiresAt').optional().isISO8601(),
    body('maxParticipants').optional().isInt({ min: 2 }),
  ],
  validate,
  controller.updateGroup.bind(controller),
);

// ============================================================
// ROUTES ADMIN
// ============================================================

/**
 * @swagger
 * /admin/groups:
 *   post:
 *     tags: [Groups]
 *     summary: UC29 — Créer un groupe manuellement (Admin)
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
 *               productId:       { type: string, format: uuid }
 *               minParticipants: { type: integer }
 *               maxParticipants: { type: integer }
 *               expiresAt:       { type: string, format: date-time }
 *               pricingTiers:    { type: array }
 *     responses:
 *       201: { description: Groupe créé par l'administration }
 */
router.post(
  '/admin/groups',
  authenticate,
  requireAdmin,
  [
    body('productId').notEmpty(),
    body('minParticipants').isInt({ min: 2 }),
    body('maxParticipants').isInt({ min: 2 }),
    body('expiresAt').isISO8601(),
    body('pricingTiers').isArray({ min: 1 }),
    body('pricingTiers.*.participantCount').isInt({ min: 1 }),
    body('pricingTiers.*.discountPercent').isFloat({ min: 1, max: 90 }),
  ],
  validate,
  controller.createGroupAdmin.bind(controller),
);

module.exports = router;