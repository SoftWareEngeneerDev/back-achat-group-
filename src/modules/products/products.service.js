// ============================================================
// PRODUCTS SERVICE — Logique métier produits & catalogue
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

class ProductsService {

  // ──────────────────────────────────────────────────────────
  // ROUTES PUBLIQUES
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée des produits approuvés avec filtres.
   * Accessible sans authentification (visiteurs).
   */
  async listProducts(query) {
    const { page, limit, skip } = getPagination(query);

    // ── Construction des filtres ───────────────────────────
    const where = { status: 'APPROVED' };
    if (query.category) where.categoryId = query.category;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    // ── Filtre prix ────────────────────────────────────────
    if (query.minPrice || query.maxPrice) {
      where.soloPrice = {};
      if (query.minPrice) where.soloPrice.gte = parseFloat(query.minPrice);
      if (query.maxPrice) where.soloPrice.lte = parseFloat(query.maxPrice);
    }

    // ── Filtre stock disponible ────────────────────────────
    if (query.inStock === 'true') where.stock = { gt: 0 };

    // ── Tri ────────────────────────────────────────────────
    let orderBy = { createdAt: 'desc' };
    if (query.sort === 'price_asc') orderBy = { soloPrice: 'asc' };
    else if (query.sort === 'price_desc') orderBy = { soloPrice: 'desc' };
    else if (query.sort === 'popular') orderBy = { groups: { _count: 'desc' } };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit, orderBy,
        select: {
          id: true,
          name: true,
          soloPrice: true,
          baseGroupPrice: true,
          stock: true,
          imagesUrls: true,
          category: { select: { id: true, name: true } },
          supplier: { select: { companyName: true } },
          _count: { select: { reviews: true, groups: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Détail complet d'un produit approuvé.
   * Inclut les avis récents et les groupes ouverts associés.
   */
  async getProduct(id) {
    const product = await prisma.product.findFirst({
      where: { id, status: 'APPROVED' },
      include: {
        category: true,
        supplier: { select: { companyName: true, id: true } },
        reviews: {
          where: { isModerated: false },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
        // Groupes ouverts liés à ce produit
        groups: {
          where: { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
          select: {
            id: true,
            title: true,
            currentCount: true,
            minParticipants: true,
            maxParticipants: true,
            currentPrice: true,
            expiresAt: true,
            status: true,
          },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      const err = new Error('Produit introuvable');
      err.status = 404;
      throw err;
    }

    return product;
  }

  /**
   * Liste des catégories hiérarchiques (parent + enfants).
   */
  async listCategories() {
    return prisma.category.findMany({
      where: { parentId: null }, // Seulement les catégories racines
      include: {
        children: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ──────────────────────────────────────────────────────────
  // ROUTES FOURNISSEUR
  // ──────────────────────────────────────────────────────────

  /**
   * UC19 — Créer un nouveau produit.
   * CORRECTION : statut initial = PENDING_APPROVAL (pas DRAFT).
   * Le fournisseur doit être validé (APPROVED) pour soumettre.
   */
  async createProduct(userId, data) {
    // ── Vérifier que le fournisseur est validé ─────────────
    const supplier = await prisma.supplier.findFirst({
      where: { userId, status: 'APPROVED' },
    });

    if (!supplier) {
      const err = new Error('Votre compte fournisseur n\'est pas encore validé par l\'admin');
      err.status = 403;
      err.code = 'SUPPLIER_NOT_APPROVED';
      throw err;
    }

    // ── Vérifier que baseGroupPrice < soloPrice ────────────
    if (data.baseGroupPrice >= data.soloPrice) {
      const err = new Error('Le prix groupé doit être inférieur au prix solo');
      err.status = 400;
      throw err;
    }

    return prisma.product.create({
      data: {
        supplierId: supplier.id,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        soloPrice: parseFloat(data.soloPrice),
        baseGroupPrice: parseFloat(data.baseGroupPrice),
        stock: parseInt(data.stock),
        imagesUrls: data.imagesUrls || [],
        status: 'PENDING_APPROVAL', // ← CORRECTION : directement en attente de validation
      },
    });
  }

  /**
   * UC20 — Modifier un produit existant.
   * CORRECTION : vérifie ownership + bloque si produit dans un groupe actif.
   */
  async updateProduct(productId, userId, data) {
    // ── Vérifier ownership ─────────────────────────────────
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403;
      throw err;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });

    if (!product) {
      const err = new Error('Produit introuvable ou accès non autorisé');
      err.status = 404;
      throw err;
    }

    // ── Bloquer si produit dans un groupe actif ────────────
    const activeGroup = await prisma.group.findFirst({
      where: { productId, status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
    });

    if (activeGroup) {
      const err = new Error('Impossible de modifier un produit avec un groupe actif en cours');
      err.status = 409;
      throw err;
    }

    // ── Filtrer uniquement les champs autorisés ────────────
    const allowed = ['name', 'description', 'soloPrice', 'baseGroupPrice', 'stock', 'imagesUrls', 'categoryId'];
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );

    // ── Repasser en PENDING_APPROVAL après modification ───
    // (nécessite une re-validation admin)
    if (product.status === 'APPROVED') {
      updateData.status = 'PENDING_APPROVAL';
    }

    return prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
  }

  /**
   * UC20 — Supprimer (archiver) un produit.
   * Impossible si un groupe actif utilise ce produit.
   */
  async deleteProduct(productId, userId) {
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403;
      throw err;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });

    if (!product) {
      const err = new Error('Produit introuvable ou accès non autorisé');
      err.status = 404;
      throw err;
    }

    // ── Vérifier absence de groupe actif ──────────────────
    const activeGroup = await prisma.group.findFirst({
      where: { productId, status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
    });

    if (activeGroup) {
      const err = new Error('Impossible de supprimer un produit avec un groupe actif');
      err.status = 409;
      throw err;
    }

    // ── Archiver au lieu de supprimer (soft delete) ───────
    return prisma.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' },
    });
  }

  /**
   * UC21 — Synchroniser le stock manuellement.
   * CORRECTION : vérifie ownership avant de modifier le stock.
   * Si stock = 0 → annule les groupes ouverts + notifie les membres.
   */
  async syncStock(productId, userId, newStock) {
    // ── Vérifier ownership ─────────────────────────────────
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403;
      throw err;
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });

    if (!product) {
      const err = new Error('Produit introuvable ou accès non autorisé');
      err.status = 404;
      throw err;
    }

    // ── Mettre à jour le stock ─────────────────────────────
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stock: parseInt(newStock) },
    });

    // ── Si rupture de stock → annuler les groupes ouverts ─
    if (newStock === 0) {
      const affectedGroups = await prisma.group.findMany({
        where: { productId, status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
        select: { id: true },
      });

      if (affectedGroups.length > 0) {
        await prisma.group.updateMany({
          where: { productId, status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
          data: { status: 'CANCELLED' },
        });

        // Notifier les membres de chaque groupe annulé
        for (const group of affectedGroups) {
          await notificationService.notifyGroupMembers(group.id, {
            type: 'GROUP_FAILED',
            title: '⚠️ Groupe annulé — Rupture de stock',
            body: `Le groupe pour "${product.name}" a été annulé suite à une rupture de stock. Votre dépôt sera remboursé sous 72h.`,
            channels: ['sms'],
          });
        }
      }
    }

    return updated;
  }

  /**
   * Liste des produits du fournisseur connecté.
   */
  async getMyProducts(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403;
      throw err;
    }

    const where = { supplierId: supplier.id };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          _count: { select: { groups: true, reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}

module.exports = new ProductsService();