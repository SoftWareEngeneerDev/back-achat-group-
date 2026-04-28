// ============================================================
// PRODUCTS ROUTES — Catalogue et gestion des produits
// Djula Market — Burkina Faso
// Base URL : /api/v1
// ============================================================

const router = require('express').Router();
const { body, param } = require('express-validator');

const controller    = require('./products.controller');
const { validate, sanitizeBody }  = require('../../middleware/validate');
const { authenticate, requireSupplier } = require('../../middleware/auth');
const { createLimiter } = require('../../middleware/rateLimit');

// ── Validateurs réutilisables ─────────────────────────────────
const productIdParam = param('id').notEmpty().withMessage('ID produit requis');

const createValidators = [
  body('name').notEmpty().trim().withMessage('Nom du produit requis'),
  body('description').notEmpty().trim().withMessage('Description requise'),
  body('soloPrice').isFloat({ min: 1 }).withMessage('Prix solo invalide (min. 1 FCFA)'),
  body('baseGroupPrice').isFloat({ min: 1 }).withMessage('Prix groupé invalide (min. 1 FCFA)'),
  body('stock').isInt({ min: 0 }).withMessage('Stock invalide (entier positif)'),
  body('categoryId').notEmpty().withMessage('Catégorie requise'),
  body('imagesUrls').optional().isArray().withMessage('imagesUrls doit être un tableau'),
];

const updateValidators = [
  body('soloPrice').optional().isFloat({ min: 1 }),
  body('baseGroupPrice').optional().isFloat({ min: 1 }),
  body('stock').optional().isInt({ min: 0 }),
  body('imagesUrls').optional().isArray(),
];

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

// GET /products — Catalogue paginé avec filtres
router.get('/products', controller.listProducts.bind(controller));

// GET /products/:id — Détail produit + groupes + avis
router.get('/products/:id',
  [productIdParam], validate,
  controller.getProduct.bind(controller)
);

// GET /categories — Catégories hiérarchiques
router.get('/categories', controller.listCategories.bind(controller));

// ============================================================
// ROUTES FOURNISSEUR
// ============================================================

// GET /supplier/products — Mes produits
router.get('/supplier/products',
  authenticate, requireSupplier,
  controller.getMyProducts.bind(controller)
);

// POST /supplier/products — Soumettre un nouveau produit
router.post('/supplier/products',
  authenticate, requireSupplier, createLimiter,
  sanitizeBody, createValidators, validate,
  controller.createProduct.bind(controller)
);

// PUT /supplier/products/:id — Modifier un produit
router.put('/supplier/products/:id',
  authenticate, requireSupplier,
  [productIdParam, ...updateValidators], validate,
  controller.updateProduct.bind(controller)
);

// DELETE /supplier/products/:id — Archiver un produit
router.delete('/supplier/products/:id',
  authenticate, requireSupplier,
  [productIdParam], validate,
  controller.deleteProduct.bind(controller)
);

// PATCH /supplier/products/:id/stock — Synchroniser le stock
router.patch('/supplier/products/:id/stock',
  authenticate, requireSupplier,
  [
    productIdParam,
    body('stock').isInt({ min: 0 }).withMessage('Stock doit être un entier positif ou nul'),
  ],
  validate,
  controller.syncStock.bind(controller)
);

module.exports = router;