// ============================================================
// GROUPS ROUTES — Groupes d'achat
// Djula Market — Burkina Faso
// Base URL : /api/v1/groups
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');

const controller = require('./groups.controller');
const { validate, sanitizeBody }                    = require('../../middleware/validate');
const { authenticate, optionalAuth,
        requireAdmin, requireSupplier }              = require('../../middleware/auth');
const { joinGroupLimiter, createLimiter }           = require('../../middleware/rateLimit');

// ── Validateurs réutilisables ─────────────────────────────────
const groupIdParam = param('id').notEmpty().withMessage('ID groupe requis');

const pricingTiersValidators = [
  body('pricingTiers').isArray({ min: 1 }).withMessage('Au moins un palier de prix requis'),
  body('pricingTiers.*.participantCount').isInt({ min: 1 }).withMessage('Nombre de participants invalide'),
  body('pricingTiers.*.discountPercent').isFloat({ min: 1, max: 90 }).withMessage('Réduction entre 1% et 90%'),
];

const createGroupValidators = [
  body('productId').notEmpty().withMessage('ID produit requis'),
  body('minParticipants').isInt({ min: 2 }).withMessage('Minimum 2 participants'),
  body('maxParticipants').isInt({ min: 3 }).withMessage('Maximum invalide (min. 3)'),
  body('expiresAt').isISO8601().withMessage('Date d\'expiration invalide (format ISO8601)'),
  body('depositPercent').optional().isFloat({ min: 0.05, max: 0.5 }).withMessage('Dépôt entre 5% et 50%'),
  ...pricingTiersValidators,
];

const updateGroupValidators = [
  body('expiresAt').optional().isISO8601().withMessage('Date invalide'),
  body('maxParticipants').optional().isInt({ min: 3 }).withMessage('Maximum invalide'),
];

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

// GET /groups — Liste paginée avec filtres
router.get('/groups', optionalAuth, controller.listGroups.bind(controller));

// GET /groups/:id — Détail d'un groupe
router.get('/groups/:id',
  optionalAuth,
  [groupIdParam], validate,
  controller.getGroup.bind(controller)
);

// GET /groups/:id/progress — Progression temps réel
router.get('/groups/:id/progress',
  [groupIdParam], validate,
  controller.getGroupProgress.bind(controller)
);

// ============================================================
// ROUTES MEMBRE
// ============================================================

// POST /groups/:id/join — Étape 1 : rejoindre un groupe
router.post('/groups/:id/join',
  authenticate, joinGroupLimiter,
  [groupIdParam], validate,
  controller.joinGroup.bind(controller)
);

// DELETE /groups/:id/leave — Quitter un groupe
router.delete('/groups/:id/leave',
  authenticate,
  [groupIdParam], validate,
  controller.leaveGroup.bind(controller)
);

// ============================================================
// ROUTES FOURNISSEUR
// ============================================================

// POST /supplier/groups — Créer un groupe
router.post('/supplier/groups',
  authenticate, requireSupplier, createLimiter,
  sanitizeBody, createGroupValidators, validate,
  controller.createGroup.bind(controller)
);

// PUT /supplier/groups/:id — Modifier un groupe
router.put('/supplier/groups/:id',
  authenticate, requireSupplier,
  [groupIdParam, ...updateGroupValidators], validate,
  controller.updateGroup.bind(controller)
);

// ============================================================
// ROUTES ADMIN
// ============================================================

// POST /admin/groups — Créer un groupe manuellement
router.post('/admin/groups',
  authenticate, requireAdmin,
  sanitizeBody, createGroupValidators, validate,
  controller.createGroupAdmin.bind(controller)
);

// PUT /admin/groups/:id — Modifier n'importe quel groupe
router.put('/admin/groups/:id',
  authenticate, requireAdmin,
  [groupIdParam, ...updateGroupValidators], validate,
  controller.updateGroupAdmin.bind(controller)
);

module.exports = router;