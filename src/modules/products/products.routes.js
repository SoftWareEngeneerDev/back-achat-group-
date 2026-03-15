const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./products.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireAdmin, requireSupplier } = require('../../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Gestion des produits et catégories
 */

// Public

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Liste globale des produits approuvés
 *     responses:
 *       200:
 *         description: Liste des produits
 */
router.get('/products', controller.listProducts.bind(controller));

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Détails d'un produit public
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails du produit
 */
router.get('/products/:id', controller.getProduct.bind(controller));

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Products]
 *     summary: Liste globale des catégories
 *     responses:
 *       200:
 *         description: Liste des catégories
 */
router.get('/categories', controller.listCategories.bind(controller));

// Fournisseur

/**
 * @swagger
 * /supplier/products:
 *   post:
 *     tags: [Products]
 *     summary: Créer un nouveau produit (Fournisseur)
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
 *               name: { type: string, example: "Sac de Riz 25kg" }
 *               description: { type: string, example: "Riz parfumé 1er choix" }
 *               soloPrice: { type: number, example: 15000 }
 *               baseGroupPrice: { type: number, example: 12000 }
 *               stock: { type: integer, example: 100 }
 *               categoryId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Produit créé (en attente de validation)
 */
router.post('/supplier/products', authenticate, requireSupplier, [
  body('name').notEmpty(),
  body('description').notEmpty(),
  body('soloPrice').isFloat({ min: 0 }),
  body('baseGroupPrice').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  body('categoryId').notEmpty(),
], validate, controller.createProduct.bind(controller));

/**
 * @swagger
 * /supplier/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Modifier un produit existant (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               soloPrice: { type: number }
 *               baseGroupPrice: { type: number }
 *               stock: { type: integer }
 *     responses:
 *       200:
 *         description: Produit modifié
 */
router.put('/supplier/products/:id', authenticate, requireSupplier, controller.updateProduct.bind(controller));

/**
 * @swagger
 * /supplier/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Supprimer un produit (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Produit supprimé
 */
router.delete('/supplier/products/:id', authenticate, requireSupplier, controller.deleteProduct.bind(controller));

/**
 * @swagger
 * /supplier/products/{id}/stock:
 *   patch:
 *     tags: [Products]
 *     summary: Ajuster le stock d'un produit (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stock]
 *             properties:
 *               stock: { type: integer, example: 50 }
 *     responses:
 *       200:
 *         description: Stock ajusté
 */
router.patch('/supplier/products/:id/stock', authenticate, requireSupplier, [
  body('stock').isInt({ min: 0 }),
], validate, controller.syncStock.bind(controller));

// Admin

/**
 * @swagger
 * /admin/products/pending:
 *   get:
 *     tags: [Products]
 *     summary: Liste des produits en attente de validation (Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des produits
 */
router.get('/admin/products/pending', authenticate, requireAdmin, controller.getPendingProducts.bind(controller));

/**
 * @swagger
 * /admin/products/{id}/approve:
 *   patch:
 *     tags: [Products]
 *     summary: Approuver ou rejeter un produit (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approved]
 *             properties:
 *               approved: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Statut du produit mis à jour
 */
router.patch('/admin/products/:id/approve', authenticate, requireAdmin, [
  body('approved').isBoolean(),
], validate, controller.approveProduct.bind(controller));

module.exports = router;
