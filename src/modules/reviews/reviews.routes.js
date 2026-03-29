// ============================================================
// REVIEWS ROUTES — Avis produits
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { success, created, paginated, forbidden, conflict } = require('../../utils/response'); // ← CORRECTION
const { validate } = require('../../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Avis et notes produits
 */

/**
 * @swagger
 * /products/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: UC17 — Avis publics d'un produit
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: Avis paginés avec note moyenne }
 */
router.get('/products/:id/reviews', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const [data, total, avgResult] = await Promise.all([
      prisma.review.findMany({
        where: { productId: req.params.id, isModerated: false },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where: { productId: req.params.id, isModerated: false } }),
      // Calculer la note moyenne
      prisma.review.aggregate({
        where: { productId: req.params.id, isModerated: false },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        averageRating: avgResult._avg.rating
          ? Math.round(avgResult._avg.rating * 10) / 10
          : null,
        totalRatings: avgResult._count.rating,
      },
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /products/{id}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: UC17 — Laisser un avis (uniquement après réception du produit)
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
 *             required: [rating]
 *             properties:
 *               rating:  { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string, maxLength: 500, example: "Très bon riz !" }
 *     responses:
 *       201: { description: Avis enregistré }
 *       403: { description: Produit pas encore reçu }
 *       409: { description: Avis déjà soumis }
 */
router.post(
  '/products/:id/reviews',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Note entre 1 et 5'),
    body('comment').optional().trim().isLength({ max: 500 }).withMessage('Commentaire max 500 caractères'),
  ],
  validate,
  async (req, res, next) => {
    try {
      // ── Vérifier que l'utilisateur a bien reçu ce produit ─
      const delivered = await prisma.groupMember.findFirst({
        where: {
          userId: req.user.id,
          status: 'PAID',
          group: {
            productId: req.params.id,
            status: 'CLOSED',
          },
        },
      });

      if (!delivered) {
        return forbidden(res, 'Vous devez avoir reçu ce produit pour laisser un avis'); // ← CORRECTION
      }

      // ── Vérifier unicité de l'avis ─────────────────────────
      const existing = await prisma.review.findFirst({
        where: { userId: req.user.id, productId: req.params.id },
      });

      if (existing) {
        return conflict(res, 'Vous avez déjà soumis un avis pour ce produit'); // ← CORRECTION
      }

      const review = await prisma.review.create({
        data: {
          userId: req.user.id,
          productId: req.params.id,
          rating: req.body.rating,
          comment: req.body.comment || null,
          isModerated: false,
        },
      });

      return created(res, review, 'Avis enregistré avec succès');
    } catch (err) { next(err); }
  },
);

/**
 * @swagger
 * /admin/reviews/{id}/moderate:
 *   patch:
 *     tags: [Reviews]
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
 *       200: { description: Avis masqué ou affiché }
 */
router.patch(
  '/admin/reviews/:id/moderate',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      await prisma.review.update({
        where: { id: req.params.id },
        data: { isModerated: req.body.moderate === true },
      });
      return success(res, null, `Avis ${req.body.moderate ? 'masqué' : 'affiché'}`);
    } catch (err) { next(err); }
  },
);

module.exports = router;