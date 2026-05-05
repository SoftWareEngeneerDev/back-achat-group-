// ============================================================
// PRODUCTS CONTROLLER — Traitement des requêtes HTTP
// Djula Market — Burkina Faso
// ============================================================
const productsService = require('./products.service');
const { success, created, paginated } = require('../../utils/response');

class ProductsController {

  // ── Publiques ─────────────────────────────────────────────
  async listProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await productsService.listProducts(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async getProduct(req, res, next) {
    try {
      const product = await productsService.getProduct(req.params.id);
      return success(res, product);
    } catch (err) { next(err); }
  }

  async listCategories(req, res, next) {
    try {
      const categories = await productsService.listCategories();
      return success(res, categories);
    } catch (err) { next(err); }
  }

  // ── Catégories Admin ──────────────────────────────────────
  async createCategory(req, res, next) {
    try {
      const category = await productsService.createCategory(req.body);
      return created(res, category, 'Catégorie créée avec succès');
    } catch (err) { next(err); }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await productsService.updateCategory(req.params.id, req.body);
      return success(res, category, 'Catégorie mise à jour');
    } catch (err) { next(err); }
  }

  async deleteCategory(req, res, next) {
    try {
      const result = await productsService.deleteCategory(req.params.id);
      return success(res, result);
    } catch (err) { next(err); }
  }

  // ── Fournisseur ───────────────────────────────────────────
  async getMyProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await productsService.getMyProducts(req.user.id, req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  async createProduct(req, res, next) {
    try {
      const product = await productsService.createProduct(req.user.id, req.body);
      return created(res, product, 'Produit soumis — en attente de validation admin');
    } catch (err) { next(err); }
  }

  async updateProduct(req, res, next) {
    try {
      const product = await productsService.updateProduct(req.params.id, req.user.id, req.body);
      return success(res, product, 'Produit mis à jour — resoumis pour validation');
    } catch (err) { next(err); }
  }

  async deleteProduct(req, res, next) {
    try {
      await productsService.deleteProduct(req.params.id, req.user.id);
      return success(res, null, 'Produit archivé avec succès');
    } catch (err) { next(err); }
  }

  async syncStock(req, res, next) {
    try {
      const product = await productsService.syncStock(req.params.id, req.user.id, req.body.stock);
      return success(res, product, 'Stock synchronisé');
    } catch (err) { next(err); }
  }
}

module.exports = new ProductsController();