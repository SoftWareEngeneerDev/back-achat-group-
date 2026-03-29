// ============================================================
// ADMIN ROUTES — Endpoints de l'espace administration
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1/admin
// Accès : ADMIN uniquement (authenticate + requireAdmin)
// Couvre : UC27 à UC38 du cahier des charges
// ============================================================

const router = require('express').Router();
const { body, query } = require('express-validator');
const controller = require('./admin.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

// Tous les endpoints admin nécessitent authentification + rôle ADMIN
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Espace administration — accès ADMIN uniquement
 */

// ============================================================
// FOURNISSEURS — UC27
// ============================================================

/**
 * @swagger
 * /admin/suppliers:
 *   get:
 *     tags: [Admin]
 *     summary: Liste paginée des fournisseurs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED, ALL]
 *           default: PENDING
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste paginée des fournisseurs }
 */
router.get('/admin/suppliers', controller.getSuppliers.bind(controller));

/**
 * @swagger
 * /admin/suppliers/{id}/validate:
 *   patch:
 *     tags: [Admin]
 *     summary: UC27 — Valider ou rejeter un fournisseur
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
 *             required: [approved]
 *             properties:
 *               approved: { type: boolean, example: true }
 *               reason:   { type: string, example: "Documents incomplets" }
 *     responses:
 *       200: { description: Fournisseur validé ou rejeté + notification envoyée }
 *       404: { description: Fournisseur introuvable }
 *       409: { description: Fournisseur déjà traité }
 */
router.patch(
  '/admin/suppliers/:id/validate',
  [
    body('approved').isBoolean().withMessage('approved doit être true ou false'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.validateSupplier.bind(controller),
);

// ============================================================
// PRODUITS — UC28
// ============================================================

/**
 * @swagger
 * /admin/products/pending:
 *   get:
 *     tags: [Admin]
 *     summary: UC28 — Produits en attente de validation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Liste paginée des produits PENDING_APPROVAL }
 */
router.get('/admin/products/pending', controller.getPendingProducts.bind(controller));

/**
 * @swagger
 * /admin/products/{id}/validate:
 *   patch:
 *     tags: [Admin]
 *     summary: UC28 — Approuver ou rejeter un produit
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
 *             required: [approved]
 *             properties:
 *               approved: { type: boolean }
 *               reason:   { type: string }
 *     responses:
 *       200: { description: Produit approuvé ou rejeté + notification fournisseur }
 *       404: { description: Produit introuvable }
 */
router.patch(
  '/admin/products/:id/validate',
  [
    body('approved').isBoolean().withMessage('approved doit être true ou false'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.validateProduct.bind(controller),
);

// ============================================================
// UTILISATEURS — UC30, UC34
// ============================================================

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: UC30 — Liste paginée de tous les utilisateurs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, BANNED, PENDING_VERIFICATION] }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [MEMBER, SUPPLIER, GROUP_LEADER, ADMIN] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par nom, téléphone ou email
 *     responses:
 *       200: { description: Liste paginée des utilisateurs }
 */
router.get('/admin/users', controller.getUsers.bind(controller));

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: UC30 — Suspendre, bannir ou réactiver un utilisateur
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
 *               status: { type: string, enum: [ACTIVE, SUSPENDED, BANNED] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Statut mis à jour, sessions révoquées si suspendu/banni }
 *       400: { description: Impossible de modifier son propre statut }
 */
router.patch(
  '/admin/users/:id/status',
  [
    body('status')
      .isIn(['ACTIVE', 'SUSPENDED', 'BANNED'])
      .withMessage('Statut invalide. Valeurs : ACTIVE, SUSPENDED, BANNED'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.updateUserStatus.bind(controller),
);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   put:
 *     tags: [Admin]
 *     summary: UC34 — Modifier le rôle d'un utilisateur
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
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [MEMBER, SUPPLIER, GROUP_LEADER, ADMIN] }
 *     responses:
 *       200: { description: Rôle mis à jour }
 */
router.put(
  '/admin/users/:id/role',
  [
    body('role')
      .isIn(['MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN'])
      .withMessage('Rôle invalide'),
  ],
  validate,
  controller.updateUserRole.bind(controller),
);

// ============================================================
// GROUPES — UC29, UC31
// ============================================================

/**
 * @swagger
 * /admin/groups:
 *   get:
 *     tags: [Admin]
 *     summary: UC31 — Liste paginée de tous les groupes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, THRESHOLD_REACHED, CLOSED, FAILED, CANCELLED]
 *     responses:
 *       200: { description: Liste paginée des groupes }
 */
router.get('/admin/groups', controller.getGroups.bind(controller));

/**
 * @swagger
 * /admin/groups/{id}/close:
 *   patch:
 *     tags: [Admin]
 *     summary: UC31 — Fermer un groupe prématurément
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
 *               reason: { type: string, example: "Fournisseur indisponible" }
 *     responses:
 *       200: { description: Groupe annulé, membres notifiés }
 *       409: { description: Groupe déjà fermé }
 */
router.patch(
  '/admin/groups/:id/close',
  [
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.closeGroup.bind(controller),
);

// ============================================================
// REMBOURSEMENTS — UC32
// ============================================================

/**
 * @swagger
 * /admin/refunds:
 *   get:
 *     tags: [Admin]
 *     summary: UC32 — Liste des paiements en attente de remboursement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Dépôts en escrow à rembourser }
 */
router.get('/admin/refunds', controller.getPendingRefunds.bind(controller));

/**
 * @swagger
 * /admin/refunds/{id}/process:
 *   post:
 *     tags: [Admin]
 *     summary: UC32 — Traiter un remboursement manuellement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Remboursement effectué, utilisateur notifié }
 *       409: { description: Paiement non remboursable }
 */
router.post('/admin/refunds/:id/process', controller.processRefund.bind(controller));

// ============================================================
// ANALYTICS — UC33, UC36
// ============================================================

/**
 * @swagger
 * /admin/analytics/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: UC33 — KPIs globaux de la plateforme
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Indicateurs clés (users, groupes, revenus, commissions) }
 */
router.get('/admin/analytics/dashboard', controller.getDashboard.bind(controller));

/**
 * @swagger
 * /admin/analytics/groups:
 *   get:
 *     tags: [Admin]
 *     summary: UC33 — Statistiques des groupes (30 jours)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Répartition par statut + groupes récents }
 */
router.get('/admin/analytics/groups', controller.getGroupsAnalytics.bind(controller));

/**
 * @swagger
 * /admin/analytics/payments:
 *   get:
 *     tags: [Admin]
 *     summary: UC36 — Statistiques des paiements
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Répartition par méthode, type + total escrow }
 */
router.get('/admin/analytics/payments', controller.getPaymentsAnalytics.bind(controller));

// ============================================================
// MONITORING — UC37
// ============================================================

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     tags: [Admin]
 *     summary: UC37 — État de santé du système
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Statut DB, mémoire, uptime, version Node }
 */
router.get('/admin/system/health', controller.getSystemHealth.bind(controller));

// ============================================================
// AUDIT LOGS — UC38
// ============================================================

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: UC38 — Historique des actions administratives
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: entity
 *         schema: { type: string, enum: [User, Supplier, Product, Group, Payment, System] }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Logs d'audit paginés }
 */
router.get('/admin/audit-logs', controller.getAuditLogs.bind(controller));

/**
 * @swagger
 * /admin/backup/export:
 *   post:
 *     tags: [Admin]
 *     summary: UC38 — Export GDPR global
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Export initié avec comptage des entités }
 */
router.post('/admin/backup/export', controller.exportGDPR.bind(controller));

module.exports = router;