// ============================================================
// ORDERS ROUTES — Commandes et expéditions
// Djula Market — Burkina Faso
// Base URL : /api/v1
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');

const controller    = require('./orders.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');

// ── Validateur réutilisable ───────────────────────────────────
const orderIdParam = param('id').notEmpty().withMessage('ID commande requis');

// ============================================================
// MEMBRE
// ============================================================

// GET /orders/me — Mes commandes
router.get('/orders/me',
  authenticate,
  controller.getMyOrders.bind(controller)
);

// GET /orders/:id — Détail + suivi d'une commande
router.get('/orders/:id',
  authenticate,
  [orderIdParam], validate,
  controller.getOrderById.bind(controller)
);

// PATCH /orders/:id/confirm-delivery — Confirmer la réception
router.patch('/orders/:id/confirm-delivery',
  authenticate,
  [orderIdParam], validate,
  controller.confirmDelivery.bind(controller)
);

// ============================================================
// FOURNISSEUR
// ============================================================

// GET /supplier/orders — Commandes du fournisseur
router.get('/supplier/orders',
  authenticate, requireSupplier,
  controller.getSupplierOrders.bind(controller)
);

// PATCH /supplier/orders/:id/confirm — Prendre en charge
router.patch('/supplier/orders/:id/confirm',
  authenticate, requireSupplier,
  [orderIdParam], validate,
  controller.confirmOrder.bind(controller)
);

// PATCH /supplier/orders/:id/ship — Marquer comme expédiée
router.patch('/supplier/orders/:id/ship',
  authenticate, requireSupplier,
  [
    orderIdParam,
    body('trackingCode').notEmpty().trim().withMessage('Code de suivi requis'),
  ],
  validate,
  controller.shipOrder.bind(controller)
);

// ============================================================
// ADMIN
// ============================================================

// GET /admin/orders — Toutes les commandes
router.get('/admin/orders',
  authenticate, requireAdmin,
  controller.getAllOrders.bind(controller)
);

// PATCH /admin/orders/:id/status — Forcer un statut
router.patch('/admin/orders/:id/status',
  authenticate, requireAdmin,
  [
    orderIdParam,
    body('status')
      .notEmpty()
      .isIn(['CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
      .withMessage('Statut invalide'),
  ],
  validate,
  controller.updateOrderStatus.bind(controller)
);

module.exports = router;