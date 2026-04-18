// ============================================================
// PRODUCTS CONTROLLER — Traitement des requêtes HTTP
// Plateforme Achats Groupés — Burkina Faso
// ============================================================
// Chaque fournisseur ne gère QUE ses propres produits.
// La vérification d'ownership est faite dans le service.
// ============================================================

const productsService = require('./products.service');
const { success, created, paginated } = require('../../utils/response');

class ProductsController {

  // ──────────────────────────────────────────────────────────
  // ROUTES PUBLIQUES (sans authentification)
  // ──────────────────────────────────────────────────────────

  /** GET /products — Catalogue public paginé avec filtres */
  async listProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await productsService.listProducts(req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  /** GET /products/:id — Détail d'un produit public */
  async getProduct(req, res, next) {
    try {
      const product = await productsService.getProduct(req.params.id);
      return success(res, product);
    } catch (err) { next(err); }
  }

  /** GET /categories — Liste des catégories hiérarchiques */
  async listCategories(req, res, next) {
    try {
      const categories = await productsService.listCategories();
      return success(res, categories);
    } catch (err) { next(err); }
  }

  // ──────────────────────────────────────────────────────────
  // ROUTES FOURNISSEUR (ses produits uniquement)
  // ──────────────────────────────────────────────────────────

  /** GET /supplier/products — Liste de MES produits uniquement */
  async getMyProducts(req, res, next) {
    try {
      const { data, total, page, limit } = await productsService.getMyProducts(req.user.id, req.query);
      return paginated(res, data, page, limit, total);
    } catch (err) { next(err); }
  }

  /** POST /supplier/products — Soumettre un nouveau produit */
  async createProduct(req, res, next) {
    try {
      const product = await productsService.createProduct(req.user.id, req.body);
      return created(res, product, 'Produit soumis, en attente de validation admin');
    } catch (err) { next(err); }
  }

  /** PUT /supplier/products/:id — Modifier UN DE MES produits */
  async updateProduct(req, res, next) {
    try {
      const product = await productsService.updateProduct(req.params.id, req.user.id, req.body);
      return success(res, product, 'Produit mis à jour');
    } catch (err) { next(err); }
  }

  /** DELETE /supplier/products/:id — Archiver UN DE MES produits */
  async deleteProduct(req, res, next) {
    try {
      await productsService.deleteProduct(req.params.id, req.user.id);
      return success(res, null, 'Produit archivé avec succès');
    } catch (err) { next(err); }
  }

  /** PATCH /supplier/products/:id/stock — Sync stock d'UN DE MES produits */
  async syncStock(req, res, next) {
    try {
      const product = await productsService.syncStock(req.params.id, req.user.id, req.body.stock);
      return success(res, product, 'Stock synchronisé');
    } catch (err) { next(err); }
  }
}

module.exports = new ProductsController();