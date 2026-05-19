// ============================================================
// ADMIN ROUTES — Espace administration
// Base URL : /api/v1/admin
// ============================================================
const router = require('express').Router();
const { body, param } = require('express-validator');
const controller    = require('./admin.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimit');

router.use(authenticate, requireAdmin, adminLimiter);

const idParam = param('id').notEmpty().withMessage('ID requis');
const approvedValidator = [
  body('approved').isBoolean(),
  body('reason').optional().isString().trim(),
];

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: 🛡️ Administration — Gestion complète de la plateforme
 */

/**
 * @swagger
 * /admin/analytics/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: KPIs globaux de la plateforme
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques globales
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalMembers    : { type: integer, example: 5247 }
 *                     activeGroups    : { type: integer, example: 43 }
 *                     totalGroups     : { type: integer, example: 120 }
 *                     successRate     : { type: number, example: 89.5 }
 *                     newMembersToday : { type: integer, example: 23 }
 *                     totalRevenue    : { type: number, example: 3240000 }
 *                     totalCommissions: { type: number, example: 226800 }
 *                     escrowAmount    : { type: number, example: 1250000 }
 *                     pendingProducts : { type: integer, example: 3 }
 *                     pendingSuppliers: { type: integer, example: 4 }
 *                     openDisputes    : { type: integer, example: 7 }
 */
router.get('/analytics/dashboard', controller.getDashboard.bind(controller));

/**
 * @swagger
 * /admin/analytics/payments:
 *   get:
 *     tags: [Admin]
 *     summary: Analytics paiements (répartition par méthode et type)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques paiements
 */
router.get('/analytics/payments', controller.getPaymentsAnalytics.bind(controller));

/**
 * @swagger
 * /admin/analytics/groups:
 *   get:
 *     tags: [Admin]
 *     summary: Analytics groupes (répartition par statut)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques groupes
 */
router.get('/analytics/groups', controller.getGroupsAnalytics.bind(controller));

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Liste tous les utilisateurs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, BANNED, PENDING_VERIFICATION] }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [MEMBER, SUPPLIER, ADMIN] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Recherche par nom, téléphone, email ou ID
 *     responses:
 *       200:
 *         description: Liste paginée des utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *                 meta: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/users', controller.getUsers.bind(controller));

/**
 * @swagger
 * /admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Modifier le statut d'un utilisateur (suspendre/réactiver)
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
 *       200: { description: Statut mis à jour — utilisateur notifié }
 *       400: { description: Auto-modification interdite }
 */
router.patch('/users/:id/status',
  [idParam, body('status').isIn(['ACTIVE', 'SUSPENDED', 'BANNED']), body('reason').optional().isString().trim()],
  validate, controller.updateUserStatus.bind(controller)
);

/**
 * @swagger
 * /admin/users/{id}/role:
 *   put:
 *     tags: [Admin]
 *     summary: Modifier le rôle d'un utilisateur
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
 *               role: { type: string, enum: [MEMBER, SUPPLIER, ADMIN] }
 *     responses:
 *       200: { description: Rôle mis à jour }
 */
router.put('/users/:id/role',
  [idParam, body('role').isIn(['MEMBER', 'SUPPLIER', 'ADMIN'])],
  validate, controller.updateUserRole.bind(controller)
);

/**
 * @swagger
 * /admin/suppliers:
 *   get:
 *     tags: [Admin]
 *     summary: Liste des fournisseurs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, SUSPENDED, ALL] }
 *     responses:
 *       200: { description: Liste paginée des fournisseurs }
 */
router.get('/suppliers', controller.getSuppliers.bind(controller));

/**
 * @swagger
 * /admin/suppliers/{id}/validate:
 *   patch:
 *     tags: [Admin]
 *     summary: Approuver ou rejeter un fournisseur
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
 *               reason  : { type: string, example: "Dossier incomplet" }
 *     responses:
 *       200: { description: Fournisseur approuvé/rejeté — notifié par SMS et email }
 *       409: { description: Fournisseur déjà traité }
 */
router.get('/suppliers/:id', [idParam], validate, controller.getSupplierById.bind(controller));
router.patch('/suppliers/:id/validate', [idParam, ...approvedValidator], validate, controller.validateSupplier.bind(controller));

/**
 * @swagger
 * /admin/products/pending:
 *   get:
 *     tags: [Admin]
 *     summary: Produits en attente de validation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200: { description: Liste des produits en attente }
 */
/**
 * @swagger
 * /admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: Tous les produits (tous statuts)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING_APPROVAL, APPROVED, REJECTED, ARCHIVED, ALL] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Liste paginée de tous les produits }
 */
router.get('/products', controller.getAllProducts.bind(controller));

router.get('/products/pending', controller.getPendingProducts.bind(controller));
router.get('/products/:id', [idParam], validate, controller.getProductById.bind(controller));



/**
 * @swagger
 * /admin/products/{id}/validate:
 *   patch:
 *     tags: [Admin]
 *     summary: Approuver ou rejeter un produit
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
 *               reason  : { type: string }
 *     responses:
 *       200: { description: Produit approuvé/rejeté — fournisseur notifié }
 */
router.patch('/products/:id/validate', [idParam, ...approvedValidator], validate, controller.validateProduct.bind(controller));

/**
 * @swagger
 * /admin/groups:
 *   get:
 *     tags: [Admin]
 *     summary: Tous les groupes d'achat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, THRESHOLD_REACHED, CLOSED, FAILED, CANCELLED, ALL] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Liste paginée des groupes }
 */
router.get('/groups', controller.getGroups.bind(controller));

/**
 * @swagger
 * /admin/groups/{id}/close:
 *   patch:
 *     tags: [Admin]
 *     summary: Fermer manuellement un groupe
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
 *       200: { description: Groupe fermé — membres notifiés }
 *       409: { description: Groupe déjà terminé }
 */
router.get('/groups/:id', [idParam], validate, controller.getGroupById.bind(controller));

router.patch('/groups/:id/close', [idParam, body('reason').optional().isString().trim()], validate, controller.closeGroup.bind(controller));

/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     tags: [Admin]
 *     summary: Tous les litiges
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, IN_REVIEW, RESOLVED, CLOSED, ALL] }
 *     responses:
 *       200: { description: Liste paginée des litiges }
 */
router.get('/disputes', controller.getDisputes.bind(controller));

/**
 * @swagger
 * /admin/disputes/{id}/take-charge:
 *   patch:
 *     tags: [Admin]
 *     summary: Prendre en charge un litige
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Litige en cours de traitement }
 */
router.patch('/disputes/:id/take-charge', [idParam], validate, controller.takeChargeDispute.bind(controller));

/**
 * @swagger
 * /admin/disputes/{id}/resolve:
 *   patch:
 *     tags: [Admin]
 *     summary: Résoudre un litige
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
 *               resolution: { type: string }
 *     responses:
 *       200: { description: Litige résolu — membre notifié }
 */
router.patch('/disputes/:id/resolve',
  [idParam, body('resolution').notEmpty().trim()],
  validate, controller.resolveDispute.bind(controller)
);

/**
 * @swagger
 * /admin/payments/refund:
 *   post:
 *     tags: [Admin]
 *     summary: Rembourser manuellement un paiement
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentId, reason]
 *             properties:
 *               paymentId: { type: string, format: uuid }
 *               reason   : { type: string }
 *     responses:
 *       200: { description: Remboursement effectué }
 */
router.post('/payments/refund',
  [body('paymentId').notEmpty(), body('reason').notEmpty().trim()],
  validate, controller.refundPayment.bind(controller)
);

/**
 * @swagger
 * /admin/refunds:
 *   get:
 *     tags: [Admin]
 *     summary: Paiements en attente de remboursement
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Liste des paiements ESCROWED }
 */
router.get('/refunds', controller.getPendingRefunds.bind(controller));

/**
 * @swagger
 * /admin/refunds/{id}/process:
 *   post:
 *     tags: [Admin]
 *     summary: Traiter un remboursement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Remboursement traité }
 */
router.post('/refunds/:id/process', [idParam], validate, controller.processRefund.bind(controller));

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     tags: [Admin]
 *     summary: Santé du système (DB, mémoire, uptime)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: État du système
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status    : { type: string, enum: [healthy, degraded] }
 *                     uptime    : { type: integer }
 *                     database  : { type: object }
 *                     memory    : { type: object }
 *                     nodeVersion: { type: string }
 */
router.get('/system/health', controller.getSystemHealth.bind(controller));

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Journal d'audit des actions admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: entity
 *         schema: { type: string, enum: [User, Supplier, Product, Group, Dispute, Payment] }
 *     responses:
 *       200: { description: Journal d'audit paginé }
 */
router.get('/audit-logs', controller.getAuditLogs.bind(controller));

/**
 * @swagger
 * /admin/backup/export:
 *   post:
 *     tags: [Admin]
 *     summary: Exporter les données RGPD
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Export initié }
 */
router.post('/backup/export', controller.exportGDPR.bind(controller));

router.get('/withdrawals',
  controller.getWithdrawals.bind(controller)
);

router.patch('/withdrawals/:id/process',
  [
    idParam,
    body('approved').isBoolean().withMessage('approved (boolean) requis'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.processWithdrawal.bind(controller)
);

module.exports = router;