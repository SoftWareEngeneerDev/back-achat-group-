// ============================================================
// REVIEWS SERVICE — Avis produits
// Djula Market — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');

class ReviewsService {

  /**
   * Avis publics d'un produit avec note moyenne
   */
  async getProductReviews(productId, query) {
    const { page, limit, skip } = getPagination({ ...query, limit: query.limit || 10 });

    const [data, total, avgResult] = await Promise.all([
      prisma.review.findMany({
        where  : { productId, isModerated: false },
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { productId, isModerated: false } }),
      prisma.review.aggregate({
        where : { productId, isModerated: false },
        _avg  : { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      data, total, page, limit,
      averageRating: avgResult._avg.rating
        ? Math.round(avgResult._avg.rating * 10) / 10 : null,
      totalRatings: avgResult._count.rating,
    };
  }

  /**
   * Laisser un avis (uniquement après réception du produit)
   */
  async createReview(userId, productId, { rating, comment }) {
    // Vérifier que l'utilisateur a reçu ce produit
    const delivered = await prisma.groupMember.findFirst({
      where: {
        userId,
        status: 'PAID',
        group : { productId, status: 'CLOSED' },
      },
    });

    if (!delivered) {
      const err = new Error('Vous devez avoir reçu ce produit pour laisser un avis');
      err.status = 403; throw err;
    }

    // Vérifier qu'il n'a pas déjà soumis un avis
    const existing = await prisma.review.findFirst({
      where: { userId, productId },
    });
    if (existing) {
      const err = new Error('Vous avez déjà soumis un avis pour ce produit');
      err.status = 409; throw err;
    }

    return prisma.review.create({
      data: { userId, productId, rating, comment: comment || null, isModerated: false },
    });
  }

  /**
   * Modérer un avis (admin)
   */
  async moderateReview(reviewId, moderate) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      const err = new Error('Avis introuvable'); err.status = 404; throw err;
    }
    return prisma.review.update({
      where: { id: reviewId },
      data : { isModerated: moderate === true },
    });
  }
}

module.exports = new ReviewsService();