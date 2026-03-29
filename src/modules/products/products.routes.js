// ============================================================
// PRODUCTS ROUTES — Catalogue et gestion des produits
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./products.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireSupplier } = require('../../middleware/auth');
const { createLimiter } = require('../../middleware/rateLimit'); // ← AJOUT

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Catalogue produits et gestion fournisseur
 */

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Catalogue public des produits approuvés
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: inStock
 *         schema: { type: boolean }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, popular] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste paginée des produits }
 */
router.get('/products', controller.listProducts.bind(controller));

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Détail complet d'un produit (avis + groupes ouverts)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Détail produit avec avis et groupes actifs }
 *       404: { description: Produit introuvable }
 */
router.get('/products/:id', controller.getProduct.bind(controller));

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Products]
 *     summary: Liste des catégories hiérarchiques
 *     responses:
 *       200: { description: Catégories avec sous-catégories }
 */
router.get('/categories', controller.listCategories.bind(controller));

// ============================================================
// ROUTES FOURNISSEUR
// ============================================================

/**
 * @swagger
 * /supplier/products:
 *   get:
 *     tags: [Products]
 *     summary: UC19 — Liste de MES produits (fournisseur connecté)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, ARCHIVED]
 *     responses:
 *       200: { description: Mes produits paginés }
 */
router.get(
  '/supplier/products',
  authenticate,
  requireSupplier,
  controller.getMyProducts.bind(controller),
);

/**
 * @swagger
 * /supplier/products:
 *   post:
 *     tags: [Products]
 *     summary: UC19 — Soumettre un nouveau produit pour validation
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
 *               name:           { type: string, example: "Sac de Riz 25kg" }
 *               description:    { type: string, example: "Riz parfumé 1er choix" }
 *               soloPrice:      { type: number, example: 15000 }
 *               baseGroupPrice: { type: number, example: 12000 }
 *               stock:          { type: integer, example: 100 }
 *               categoryId:     { type: string, format: uuid }
 *               imagesUrls:     { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Produit soumis en PENDING_APPROVAL }
 *       403: { description: Compte fournisseur non validé }
 *       429: { description: Trop de créations récentes }
 */
router.post(
  '/supplier/products',
  authenticate,
  requireSupplier,
  createLimiter, // ← AJOUT : max 20 créations/heure par userId
  [
    body('name').notEmpty().withMessage('Nom du produit requis'),
    body('description').notEmpty().withMessage('Description requise'),
    body('soloPrice').isFloat({ min: 1 }).withMessage('Prix solo invalide'),
    body('baseGroupPrice').isFloat({ min: 1 }).withMessage('Prix groupé invalide'),
    body('stock').isInt({ min: 0 }).withMessage('Stock invalide'),
    body('categoryId').notEmpty().withMessage('Catégorie requise'),
    body('imagesUrls').optional().isArray(),
  ],
  validate,
  controller.createProduct.bind(controller),
);

/**
 * @swagger
 * /supplier/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: UC20 — Modifier UN DE MES produits
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
 *               name:           { type: string }
 *               description:    { type: string }
 *               soloPrice:      { type: number }
 *               baseGroupPrice: { type: number }
 *               stock:          { type: integer }
 *               imagesUrls:     { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Produit mis à jour, repassé en PENDING_APPROVAL }
 *       404: { description: Produit introuvable ou non autorisé }
 *       409: { description: Groupe actif en cours sur ce produit }
 */
router.put(
  '/supplier/products/:id',
  authenticate,
  requireSupplier,
  [
    body('soloPrice').optional().isFloat({ min: 1 }),
    body('baseGroupPrice').optional().isFloat({ min: 1 }),
    body('stock').optional().isInt({ min: 0 }),
  ],
  validate,
  controller.updateProduct.bind(controller),
);

/**
 * @swagger
 * /supplier/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: UC20 — Archiver UN DE MES produits (soft delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Produit archivé }
 *       409: { description: Groupe actif en cours }
 */
router.delete(
  '/supplier/products/:id',
  authenticate,
  requireSupplier,
  controller.deleteProduct.bind(controller),
);

/**
 * @swagger
 * /supplier/products/{id}/stock:
 *   patch:
 *     tags: [Products]
 *     summary: UC21 — Synchroniser le stock d'UN DE MES produits
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
 *               stock: { type: integer, example: 50, minimum: 0 }
 *     responses:
 *       200: { description: Stock mis à jour }
 *       404: { description: Produit introuvable ou non autorisé }
 */
router.patch(
  '/supplier/products/:id/stock',
  authenticate,
  requireSupplier,
  [
    body('stock').isInt({ min: 0 }).withMessage('Stock doit être un entier positif ou nul'),
  ],
  validate,
  controller.syncStock.bind(controller),
);

module.exports = router;