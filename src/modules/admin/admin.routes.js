// ============================================================
// ADMIN ROUTES — Espace administration
// Djula Market — Burkina Faso
// Base URL : /api/v1/admin — Accès ADMIN uniquement
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');

const controller    = require('./admin.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimit');

// Middleware global
router.use(authenticate, requireAdmin, adminLimiter);

// Validateurs réutilisables
const idParam           = param('id').notEmpty().withMessage('ID requis');
const approvedValidator = [
  body('approved').isBoolean().withMessage('approved doit être true ou false'),
  body('reason').optional().isString().trim(),
];

// ── FOURNISSEURS ─────────────────────────────────────────────
router.get  ('/suppliers',               controller.getSuppliers.bind(controller));
router.patch('/suppliers/:id/validate',
  [idParam, ...approvedValidator], validate,
  controller.validateSupplier.bind(controller)
);

// ── PRODUITS ─────────────────────────────────────────────────
router.get  ('/products/pending',        controller.getPendingProducts.bind(controller));
router.patch('/products/:id/validate',
  [idParam, ...approvedValidator], validate,
  controller.validateProduct.bind(controller)
);

// ── UTILISATEURS ─────────────────────────────────────────────
router.get  ('/users',                   controller.getUsers.bind(controller));
router.patch('/users/:id/status',
  [
    idParam,
    body('status').isIn(['ACTIVE', 'SUSPENDED', 'BANNED']).withMessage('Statut invalide'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.updateUserStatus.bind(controller)
);
router.put  ('/users/:id/role',
  [
    idParam,
    body('role').isIn(['MEMBER', 'SUPPLIER', 'ADMIN']).withMessage('Rôle invalide'),
  ],
  validate,
  controller.updateUserRole.bind(controller)
);

// ── GROUPES ──────────────────────────────────────────────────
router.get  ('/groups',                  controller.getGroups.bind(controller));
router.patch('/groups/:id/close',
  [idParam, body('reason').optional().isString().trim()], validate,
  controller.closeGroup.bind(controller)
);

// ── LITIGES ──────────────────────────────────────────────────
router.get  ('/disputes',                controller.getDisputes.bind(controller));
router.patch('/disputes/:id/take-charge',
  [idParam], validate,
  controller.takeChargeDispute.bind(controller)
);
router.patch('/disputes/:id/resolve',
  [
    idParam,
    body('resolution').notEmpty().trim().withMessage('Résolution requise'),
  ],
  validate,
  controller.resolveDispute.bind(controller)
);

// ── REMBOURSEMENTS ───────────────────────────────────────────
router.get  ('/refunds',                 controller.getPendingRefunds.bind(controller));
router.post ('/refunds/:id/process',
  [idParam], validate,
  controller.processRefund.bind(controller)
);

// ── PAIEMENTS ────────────────────────────────────────────────
router.post ('/payments/refund',
  [
    body('paymentId').notEmpty().withMessage('paymentId requis'),
    body('reason').notEmpty().trim().withMessage('Raison requise'),
  ],
  validate,
  controller.refundPayment.bind(controller)
);

// ── ANALYTICS ────────────────────────────────────────────────
router.get('/analytics/dashboard', controller.getDashboard.bind(controller));
router.get('/analytics/groups',    controller.getGroupsAnalytics.bind(controller));
router.get('/analytics/payments',  controller.getPaymentsAnalytics.bind(controller));

// ── MONITORING ───────────────────────────────────────────────
router.get ('/system/health',      controller.getSystemHealth.bind(controller));
router.get ('/audit-logs',         controller.getAuditLogs.bind(controller));
router.post('/backup/export',      controller.exportGDPR.bind(controller));

module.exports = router;