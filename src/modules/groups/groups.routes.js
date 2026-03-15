const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./groups.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireAdmin, requireSupplier, optionalAuth } = require('../../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Gestion des groupes d'achats, paliers de prix et participations
 */

// Public

/**
 * @swagger
 * /groups:
 *   get:
 *     tags: [Groups]
 *     summary: Liste des groupes d'achats actifs
 *     responses:
 *       200:
 *         description: Liste paginée des groupes
 */
router.get('/groups', controller.listGroups.bind(controller));

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     tags: [Groups]
 *     summary: Détails d'un groupe d'achat spécifique
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails du groupe incluant produit et paliers
 */
router.get('/groups/:id', controller.getGroup.bind(controller));

/**
 * @swagger
 * /groups/{id}/progress:
 *   get:
 *     tags: [Groups]
 *     summary: Suivi de la progression du groupe (membres vs paliers)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: État d'avancement du groupe
 */
router.get('/groups/:id/progress', controller.getGroupProgress.bind(controller));

// Membre connecté

/**
 * @swagger
 * /groups/{id}/join:
 *   post:
 *     tags: [Groups]
 *     summary: Rejoindre un groupe d'achat existant
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
 *         description: Adhésion réussie (retourne infos paiement acompte)
 */
router.post('/groups/:id/join', authenticate, controller.joinGroup.bind(controller));

/**
 * @swagger
 * /groups/{id}/leave:
 *   delete:
 *     tags: [Groups]
 *     summary: Quitter un groupe d'achat (annuler participation)
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
 *         description: Participation annulée
 */
router.delete('/groups/:id/leave', authenticate, controller.leaveGroup.bind(controller));

// Fournisseur

/**
 * @swagger
 * /supplier/groups:
 *   post:
 *     tags: [Groups]
 *     summary: Créer un nouveau groupe d'achat (Fournisseur)
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
 *               productId: { type: string, format: uuid }
 *               minParticipants: { type: integer, example: 10 }
 *               maxParticipants: { type: integer, example: 50 }
 *               expiresAt: { type: string, format: date-time }
 *               depositPercent: { type: number, example: 0.2 }
 *               pricingTiers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [participantCount, discountPercent]
 *                   properties:
 *                     participantCount: { type: integer, example: 10 }
 *                     discountPercent: { type: number, example: 5.5 }
 *     responses:
 *       201:
 *         description: Groupe créé
 */
router.post('/supplier/groups', authenticate, requireSupplier, [
  body('productId').notEmpty(),
  body('minParticipants').isInt({ min: 2 }),
  body('maxParticipants').isInt({ min: 2 }),
  body('expiresAt').isISO8601(),
  body('pricingTiers').isArray({ min: 1 }),
  body('pricingTiers.*.participantCount').isInt({ min: 1 }),
  body('pricingTiers.*.discountPercent').isFloat({ min: 1, max: 90 }),
], validate, controller.createGroup.bind(controller));

/**
 * @swagger
 * /supplier/groups/{id}:
 *   put:
 *     tags: [Groups]
 *     summary: Modifier un groupe existant (Fournisseur)
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
 *             properties:
 *               expiresAt: { type: string, format: date-time }
 *               maxParticipants: { type: integer }
 *     responses:
 *       200:
 *         description: Groupe mis à jour
 */
router.put('/supplier/groups/:id', authenticate, requireSupplier, controller.updateGroup.bind(controller));

// Admin

/**
 * @swagger
 * /admin/groups:
 *   post:
 *     tags: [Groups]
 *     summary: Créer un groupe d'achat forcé (Admin)
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
 *               productId: { type: string, format: uuid }
 *               minParticipants: { type: integer, example: 10 }
 *               maxParticipants: { type: integer, example: 50 }
 *               expiresAt: { type: string, format: date-time }
 *               pricingTiers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     participantCount: { type: integer }
 *                     discountPercent: { type: number }
 *     responses:
 *       201:
 *         description: Groupe créé par l'admin
 */
router.post('/admin/groups', authenticate, requireAdmin, [
  body('productId').notEmpty(),
  body('minParticipants').isInt({ min: 2 }),
  body('maxParticipants').isInt({ min: 2 }),
  body('expiresAt').isISO8601(),
  body('pricingTiers').isArray({ min: 1 }),
], validate, controller.createGroupAdmin.bind(controller));

/**
 * @swagger
 * /admin/groups/{id}/close:
 *   patch:
 *     tags: [Groups]
 *     summary: Clôturer manuellement un groupe (Admin)
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
 *         description: Groupe clôturé
 */
router.patch('/admin/groups/:id/close', authenticate, requireAdmin, controller.closeGroup.bind(controller));

module.exports = router;
