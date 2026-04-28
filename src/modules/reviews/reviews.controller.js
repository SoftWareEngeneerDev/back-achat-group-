// ============================================================
// REVIEWS CONTROLLER
// Djula Market — Burkina Faso
// ============================================================

const reviewsService = require('./reviews.service');
const { success, created, paginated } = require('../../utils/response');

class ReviewsController {

  async getProductReviews(req, res, next) {
    try {
      const { data, total, page, limit, averageRating, totalRatings } =
        await reviewsService.getProductReviews(req.params.id, req.query);
      return paginated(res, { reviews: data, averageRating, totalRatings }, page, limit, total);
    } catch (err) { next(err); }
  }

  async createReview(req, res, next) {
    try {
      const review = await reviewsService.createReview(
        req.user.id, req.params.id, req.body
      );
      return created(res, review, 'Avis enregistré avec succès');
    } catch (err) { next(err); }
  }

  async moderateReview(req, res, next) {
    try {
      await reviewsService.moderateReview(req.params.id, req.body.moderate);
      return success(res, null, `Avis ${req.body.moderate ? 'masqué' : 'affiché'}`);
    } catch (err) { next(err); }
  }
}

module.exports = new ReviewsController();