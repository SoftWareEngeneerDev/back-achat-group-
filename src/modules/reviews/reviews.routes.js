const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { success, created, paginated } = require('../../utils/response');
const { validate } = require('../../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Gestion des avis produits
 */

/**
 * @swagger
 * /products/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Liste des avis publics pour un produit
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Avis paginés
 */
router.get('/products/:id/reviews', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const [data, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId: req.params.id, isModerated: false },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.review.count({ where: { productId: req.params.id, isModerated: false } }),
    ]);
    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /products/{id}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Ajouter un avis sur un produit reçu
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
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string, example: "Très bon riz, livraison rapide !" }
 *     responses:
 *       201:
 *         description: Avis enregistré
 */
router.post('/products/:id/reviews', authenticate, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ max: 500 }),
], validate, async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur a bien reçu ce produit
    const delivered = await prisma.groupMember.findFirst({
      where: {
        userId: req.user.id,
        group: { productId: req.params.id, status: 'CLOSED' },
        status: 'PAID',
      },
    });
    if (!delivered) return require('../../utils/response').forbidden(res, 'Vous devez avoir reçu ce produit pour laisser un avis');

    const existing = await prisma.review.findFirst({ where: { userId: req.user.id, productId: req.params.id } });
    if (existing) return require('../../utils/response').conflict(res, 'Vous avez déjà noté ce produit');

    const review = await prisma.review.create({
      data: { userId: req.user.id, productId: req.params.id, rating: req.body.rating, comment: req.body.comment },
    });
    return created(res, review, 'Avis enregistré');
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/reviews/{id}/moderate:
 *   patch:
 *     tags: [Reviews]
 *     summary: Modérer (cacher/afficher) un avis (Admin)
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
 *             required: [moderate]
 *             properties:
 *               moderate: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Avis modéré
 */
router.patch('/admin/reviews/:id/moderate', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await prisma.review.update({ where: { id: req.params.id }, data: { isModerated: req.body.moderate } });
    return success(res, null, 'Avis modéré');
  } catch (err) { next(err); }
});

module.exports = router;
