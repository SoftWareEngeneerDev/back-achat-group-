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

// Middleware global — tous les endpoints admin
router.use(authenticate, requireAdmin, adminLimiter);

// ── Validateurs réutilisables ─────────────────────────────────
const idParam    = param('id').notEmpty().withMessage('ID requis');
const approvedValidator = [
  body('approved').isBoolean().withMessage('approved doit être true ou false'),
  body('reason').optional().isString().trim(),
];

// ============================================================
// FOURNISSEURS
// ============================================================

router.get ('/admin/suppliers',              controller.getSuppliers.bind(controller));
router.patch('/admin/suppliers/:id/validate',
  [idParam, ...approvedValidator], validate,
  controller.validateSupplier.bind(controller)
);

// ============================================================
// PRODUITS
// ============================================================

router.get  ('/admin/products/pending',         controller.getPendingProducts.bind(controller));
router.patch('/admin/products/:id/validate',
  [idParam, ...approvedValidator], validate,
  controller.validateProduct.bind(controller)
);

// ============================================================
// UTILISATEURS
// ============================================================

router.get  ('/admin/users', controller.getUsers.bind(controller));

router.patch('/admin/users/:id/status',
  [
    idParam,
    body('status').isIn(['ACTIVE', 'SUSPENDED', 'BANNED']).withMessage('Statut invalide'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  controller.updateUserStatus.bind(controller)
);

router.put('/admin/users/:id/role',
  [
    idParam,
    body('role').isIn(['MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN']).withMessage('Rôle invalide'),
  ],
  validate,
  controller.updateUserRole.bind(controller)
);

// ============================================================
// GROUPES
// ============================================================

router.get  ('/admin/groups',           controller.getGroups.bind(controller));
router.patch('/admin/groups/:id/close',
  [idParam, body('reason').optional().isString().trim()], validate,
  controller.closeGroup.bind(controller)
);

// ============================================================
// REMBOURSEMENTS
// ============================================================

router.get ('/admin/refunds',              controller.getPendingRefunds.bind(controller));
router.post('/admin/refunds/:id/process',
  [idParam], validate,
  controller.processRefund.bind(controller)
);

// ============================================================
// ANALYTICS
// ============================================================

router.get('/admin/analytics/dashboard', controller.getDashboard.bind(controller));
router.get('/admin/analytics/groups',    controller.getGroupsAnalytics.bind(controller));
router.get('/admin/analytics/payments',  controller.getPaymentsAnalytics.bind(controller));

// ============================================================
// MONITORING & AUDIT
// ============================================================

router.get ('/admin/system/health', controller.getSystemHealth.bind(controller));
router.get ('/admin/audit-logs',    controller.getAuditLogs.bind(controller));
router.post('/admin/backup/export', controller.exportGDPR.bind(controller));

module.exports = router;