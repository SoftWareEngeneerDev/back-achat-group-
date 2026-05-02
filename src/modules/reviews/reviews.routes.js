// ============================================================
// REVIEWS ROUTES — Avis produits
// Base URL : /api/v1
// ============================================================
const router = require('express').Router();
const { body, param } = require('express-validator');
const controller    = require('./reviews.controller');
const { validate }  = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: ⭐ Avis — Notes et commentaires produits
 */

/**
 * @swagger
 * /products/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Avis publics d'un produit
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Liste des avis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Review' }
 *   post:
 *     tags: [Reviews]
 *     summary: Laisser un avis sur un produit (après livraison)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating : { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string, maxLength: 500, example: "Excellent produit, livraison rapide !" }
 *     responses:
 *       201: { description: Avis publié }
 *       409: { description: Avis déjà posté pour ce produit }
 */
router.get('/products/:id/reviews', controller.getProductReviews.bind(controller));
router.post('/products/:id/reviews', authenticate,
  [
    param('id').notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim().isLength({ max: 500 }),
  ],
  validate, controller.createReview.bind(controller)
);

/**
 * @swagger
 * /admin/reviews/{id}/moderate:
 *   patch:
 *     tags: [Admin]
 *     summary: Modérer un avis (Admin)
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
 *             required: [moderate]
 *             properties:
 *               moderate: { type: boolean, example: true }
 *     responses:
 *       200: { description: Avis modéré }
 */
router.patch('/admin/reviews/:id/moderate', authenticate, requireAdmin,
  [param('id').notEmpty(), body('moderate').isBoolean()],
  validate, controller.moderateReview.bind(controller)
);

module.exports = router;