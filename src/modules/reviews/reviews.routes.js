// ============================================================
// REVIEWS ROUTES — Avis produits
// Djula Market — Burkina Faso
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');

const controller    = require('./reviews.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

// GET  /products/:id/reviews — Avis publics d'un produit
router.get('/products/:id/reviews',
  controller.getProductReviews.bind(controller)
);

// POST /products/:id/reviews — Laisser un avis
router.post('/products/:id/reviews',
  authenticate,
  [
    param('id').notEmpty().withMessage('ID produit requis'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5'),
    body('comment').optional().trim().isLength({ max: 500 }).withMessage('Max 500 caractères'),
  ],
  validate,
  controller.createReview.bind(controller)
);

// PATCH /admin/reviews/:id/moderate — Modérer un avis
router.patch('/admin/reviews/:id/moderate',
  authenticate, requireAdmin,
  [
    param('id').notEmpty().withMessage('ID avis requis'),
    body('moderate').isBoolean().withMessage('moderate doit être true ou false'),
  ],
  validate,
  controller.moderateReview.bind(controller)
);

module.exports = router;