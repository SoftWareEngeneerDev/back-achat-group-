// ============================================================
// PRODUCTS ROUTES — Catalogue et gestion des produits
// Base URL : /api/v1
// ============================================================
const router = require('express').Router();
const { body, param } = require('express-validator');
const controller    = require('./products.controller');
const { validate, sanitizeBody }  = require('../../middleware/validate');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');
const { createLimiter } = require('../../middleware/rateLimit');

const productIdParam  = param('id').notEmpty().withMessage('ID produit requis');
const categoryIdParam = param('id').notEmpty().withMessage('ID catégorie requis');

const createValidators = [
  body('name').notEmpty().trim().withMessage('Nom du produit requis'),
  body('description').notEmpty().trim().withMessage('Description requise'),
  body('soloPrice').isFloat({ min: 1 }).withMessage('Prix solo invalide'),
  body('baseGroupPrice').isFloat({ min: 1 }).withMessage('Prix groupé invalide'),
  body('stock').isInt({ min: 0 }).withMessage('Stock invalide'),
  body('categoryId').notEmpty().withMessage('Catégorie requise'),
  body('imagesUrls').optional().isArray(),
];

const updateValidators = [
  body('soloPrice').optional().isFloat({ min: 1 }),
  body('baseGroupPrice').optional().isFloat({ min: 1 }),
  body('stock').optional().isInt({ min: 0 }),
  body('imagesUrls').optional().isArray(),
];

const categoryValidators = [
  body('name').notEmpty().trim().withMessage('Nom de la catégorie requis'),
  body('parentId').optional().isUUID().withMessage('parentId invalide'),
];

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Catalogue produits avec filtres et pagination
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, newest, popular] }
 *       - in: query
 *         name: inStock
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Liste paginée des produits
 */
router.get('/products', controller.listProducts.bind(controller));

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Détail d'un produit avec groupes actifs et avis
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Détail complet du produit }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/products/:id', [productIdParam], validate, controller.getProduct.bind(controller));

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Products]
 *     summary: Liste toutes les catégories avec sous-catégories
 *     security: []
 *     responses:
 *       200:
 *         description: Arbre des catégories
 */
router.get('/categories', controller.listCategories.bind(controller));

// ============================================================
// GESTION CATÉGORIES — ADMIN
// ============================================================

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     tags: [Admin]
 *     summary: Créer une nouvelle catégorie
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name    : { type: string, example: "Électronique" }
 *               parentId: { type: string, format: uuid, description: "ID catégorie parente (optionnel)" }
 *     responses:
 *       201:
 *         description: Catégorie créée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id      : { type: string }
 *                     name    : { type: string }
 *                     slug    : { type: string }
 *                     parentId: { type: string, nullable: true }
 *       409: { description: Catégorie avec ce nom existe déjà }
 */
router.post('/admin/categories',
  authenticate, requireAdmin,
  categoryValidators, validate,
  controller.createCategory.bind(controller)
);

/**
 * @swagger
 * /admin/categories/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Modifier une catégorie
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
 *               name    : { type: string }
 *               parentId: { type: string, nullable: true }
 *     responses:
 *       200: { description: Catégorie mise à jour }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Admin]
 *     summary: Supprimer une catégorie (impossible si des produits l'utilisent)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Catégorie supprimée }
 *       409: { description: Des produits ou sous-catégories utilisent cette catégorie }
 */
router.put('/admin/categories/:id',
  authenticate, requireAdmin,
  [categoryIdParam, body('name').optional().trim(), body('parentId').optional()], validate,
  controller.updateCategory.bind(controller)
);

router.delete('/admin/categories/:id',
  authenticate, requireAdmin,
  [categoryIdParam], validate,
  controller.deleteCategory.bind(controller)
);

// ============================================================
// ROUTES FOURNISSEUR
// ============================================================

/**
 * @swagger
 * /supplier/products:
 *   get:
 *     tags: [Supplier]
 *     summary: Mes produits
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, ARCHIVED] }
 *     responses:
 *       200: { description: Liste de mes produits }
 *   post:
 *     tags: [Supplier]
 *     summary: Soumettre un nouveau produit pour validation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, soloPrice, baseGroupPrice, stock, categoryId]
 *             properties:
 *               name          : { type: string }
 *               description   : { type: string }
 *               soloPrice     : { type: number, example: 285000 }
 *               baseGroupPrice: { type: number, example: 185250 }
 *               stock         : { type: integer, example: 100 }
 *               categoryId    : { type: string, format: uuid }
 *               imagesUrls    : { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Produit soumis — en attente de validation }
 */
router.get ('/supplier/products', authenticate, requireSupplier, controller.getMyProducts.bind(controller));
router.post('/supplier/products', authenticate, requireSupplier, createLimiter, sanitizeBody, createValidators, validate, controller.createProduct.bind(controller));

/**
 * @swagger
 * /supplier/products/{id}:
 *   put:
 *     tags: [Supplier]
 *     summary: Modifier un produit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Produit mis à jour }
 *   delete:
 *     tags: [Supplier]
 *     summary: Archiver un produit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Produit archivé }
 */
router.put   ('/supplier/products/:id', authenticate, requireSupplier, [productIdParam, ...updateValidators], validate, controller.updateProduct.bind(controller));
router.delete('/supplier/products/:id', authenticate, requireSupplier, [productIdParam], validate, controller.deleteProduct.bind(controller));

/**
 * @swagger
 * /supplier/products/{id}/stock:
 *   patch:
 *     tags: [Supplier]
 *     summary: Synchroniser le stock d'un produit
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
 *             required: [stock]
 *             properties:
 *               stock: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: Stock mis à jour }
 */
router.patch('/supplier/products/:id/stock', authenticate, requireSupplier,
  [productIdParam, body('stock').isInt({ min: 0 })], validate,
  controller.syncStock.bind(controller)
);

module.exports = router;