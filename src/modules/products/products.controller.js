const productsService = require('./products.service');
const { success, created, paginated, notFound } = require('../../utils/response');

class ProductsController {
  async listProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await productsService.listProducts(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async getProduct(req, res, next) {
    try {
      const product = await productsService.getProduct(req.params.id);
      if (!product) return notFound(res, 'Produit');
      return success(res, product);
    } catch (err) { next(err); }
  }

  async listCategories(req, res, next) {
    try {
      return success(res, await productsService.listCategories());
    } catch (err) { next(err); }
  }

  async createProduct(req, res, next) {
    try {
      const product = await productsService.createProduct(req.user.id, req.body);
      return created(res, product, 'Produit créé, en attente de validation admin');
    } catch (err) { next(err); }
  }

  async updateProduct(req, res, next) {
    try {
      const product = await productsService.updateProduct(req.params.id, req.user.id, req.body);
      return success(res, product, 'Produit mis à jour');
    } catch (err) { next(err); }
  }

  async deleteProduct(req, res, next) {
    try {
      await productsService.deleteProduct(req.params.id, req.user.id);
      return success(res, null, 'Produit archivé');
    } catch (err) { next(err); }
  }

  async syncStock(req, res, next) {
    try {
      const product = await productsService.syncStock(req.params.id, req.user.id, req.body.stock);
      return success(res, product, 'Stock synchronisé');
    } catch (err) { next(err); }
  }

  async getPendingProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await productsService.getPendingProducts(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async approveProduct(req, res, next) {
    try {
      const product = await productsService.approveProduct(
        req.params.id, req.user.id, req.body.approved, req.body.reason
      );
      return success(res, product, `Produit ${req.body.approved ? 'approuvé' : 'rejeté'}`);
    } catch (err) { next(err); }
  }
}

module.exports = new ProductsController();
