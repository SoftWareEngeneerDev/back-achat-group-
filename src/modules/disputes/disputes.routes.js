// ============================================================
// DISPUTES ROUTES — Litiges et réclamations
// Djula Market — Burkina Faso
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');

const controller    = require('./disputes.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

// ── Validateurs réutilisables ─────────────────────────────────
const disputeIdParam = param('id').notEmpty().withMessage('ID litige requis');

// ============================================================
// MEMBRE
// ============================================================

// POST /disputes — Ouvrir un litige
router.post('/disputes',
  authenticate,
  [
    body('subject').notEmpty().trim().isLength({ max: 200 }).withMessage('Sujet requis (max 200 caractères)'),
    body('description').notEmpty().trim().isLength({ max: 1000 }).withMessage('Description requise (max 1000 caractères)'),
    body('groupId').optional().isUUID().withMessage('groupId invalide'),
    body('orderId').optional().isUUID().withMessage('orderId invalide'),
  ],
  validate,
  controller.createDispute.bind(controller)
);

// GET /disputes/me — Mes litiges
router.get('/disputes/me',
  authenticate,
  controller.getMyDisputes.bind(controller)
);

// ============================================================
// ADMIN
// ============================================================

// GET /admin/disputes — Tous les litiges
router.get('/admin/disputes',
  authenticate, requireAdmin,
  controller.getAllDisputes.bind(controller)
);

// PATCH /admin/disputes/:id/take-charge — Prendre en charge
router.patch('/admin/disputes/:id/take-charge',
  authenticate, requireAdmin,
  [disputeIdParam], validate,
  controller.takeChargeDispute.bind(controller)
);

// PATCH /admin/disputes/:id/resolve — Résoudre un litige
router.patch('/admin/disputes/:id/resolve',
  authenticate, requireAdmin,
  [
    disputeIdParam,
    body('resolution').notEmpty().trim().withMessage('Résolution requise'),
  ],
  validate,
  controller.resolveDispute.bind(controller)
);

module.exports = router;