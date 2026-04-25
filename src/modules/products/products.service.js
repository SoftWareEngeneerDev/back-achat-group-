// ============================================================
// PRODUCTS SERVICE — Logique métier produits & catalogue
// Djula Market — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

// ── Champs autorisés à la modification ───────────────────────
const ALLOWED_UPDATE_FIELDS = [
  'name', 'description', 'soloPrice', 'baseGroupPrice',
  'stock', 'imagesUrls', 'categoryId',
];

// ── Sélection catalogue public ────────────────────────────────
const PRODUCT_LIST_SELECT = {
  id: true, name: true, soloPrice: true, baseGroupPrice: true,
  stock: true, imagesUrls: true,
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, companyName: true } },
  _count   : { select: { reviews: true, groups: true } },
};

// ── Statuts de groupes actifs ─────────────────────────────────
const ACTIVE_GROUP_STATUSES = ['OPEN', 'THRESHOLD_REACHED'];

// ── Helper fournisseur ────────────────────────────────────────
const getSupplier = async (userId, mustBeApproved = false) => {
  const where = { userId };
  if (mustBeApproved) where.status = 'APPROVED';

  const supplier = await prisma.supplier.findFirst({ where });
  if (!supplier) {
    const err = new Error(
      mustBeApproved
        ? 'Votre compte fournisseur n\'est pas encore validé'
        : 'Profil fournisseur introuvable'
    );
    err.status = mustBeApproved ? 403 : 403;
    err.code   = mustBeApproved ? 'SUPPLIER_NOT_APPROVED' : 'SUPPLIER_NOT_FOUND';
    throw err;
  }
  return supplier;
};

class ProductsService {

  // ──────────────────────────────────────────────────────────
  // ROUTES PUBLIQUES
  // ──────────────────────────────────────────────────────────

  async listProducts(query) {
    const { page, limit, skip } = getPagination(query);

    const where = { status: 'APPROVED' };
    if (query.category) where.categoryId = query.category;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
    if (query.inStock === 'true') where.stock = { gt: 0 };

    if (query.minPrice || query.maxPrice) {
      where.soloPrice = {};
      if (query.minPrice) where.soloPrice.gte = parseFloat(query.minPrice);
      if (query.maxPrice) where.soloPrice.lte = parseFloat(query.maxPrice);
    }

    const sortMap = {
      price_asc : { soloPrice: 'asc' },
      price_desc: { soloPrice: 'desc' },
      popular   : { groups: { _count: 'desc' } },
      newest    : { createdAt: 'desc' },
    };
    const orderBy = sortMap[query.sort] ?? { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take: limit, orderBy, select: PRODUCT_LIST_SELECT }),
      prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getProduct(id) {
    const product = await prisma.product.findFirst({
      where  : { id, status: 'APPROVED' },
      include: {
        category: true,
        supplier: { select: { id: true, companyName: true, rating: true } },
        reviews : {
          where  : { isModerated: false },
          take   : 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
        groups: {
          where : { status: { in: ACTIVE_GROUP_STATUSES } },
          select: {
            id: true, title: true, currentCount: true,
            minParticipants: true, maxParticipants: true,
            currentPrice: true, expiresAt: true, status: true,
          },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) {
      const err = new Error('Produit introuvable');
      err.status = 404; throw err;
    }

    return product;
  }

  async listCategories() {
    return prisma.category.findMany({
      where  : { parentId: null },
      include: { children: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  // ──────────────────────────────────────────────────────────
  // ROUTES FOURNISSEUR
  // ──────────────────────────────────────────────────────────

  async getMyProducts(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const supplier = await getSupplier(userId);

    const where = { supplierId: supplier.id };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take   : limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true } },
          _count  : { select: { groups: true, reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async createProduct(userId, data) {
    const supplier = await getSupplier(userId, true); // doit être APPROVED

    if (parseFloat(data.baseGroupPrice) >= parseFloat(data.soloPrice)) {
      const err = new Error('Le prix groupé doit être inférieur au prix solo');
      err.status = 400; throw err;
    }

    return prisma.product.create({
      data: {
        supplierId    : supplier.id,
        categoryId    : data.categoryId,
        name          : data.name,
        description   : data.description,
        soloPrice     : parseFloat(data.soloPrice),
        baseGroupPrice: parseFloat(data.baseGroupPrice),
        stock         : parseInt(data.stock),
        imagesUrls    : data.imagesUrls || [],
        status        : 'PENDING_APPROVAL',
      },
    });
  }

  async updateProduct(productId, userId, data) {
    const supplier = await getSupplier(userId);

    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });
    if (!product) {
      const err = new Error('Produit introuvable ou accès non autorisé');
      err.status = 404; throw err;
    }

    const activeGroup = await prisma.group.findFirst({
      where: { productId, status: { in: ACTIVE_GROUP_STATUSES } },
    });
    if (activeGroup) {
      const err = new Error('Impossible de modifier un produit avec un groupe actif en cours');
      err.status = 409; throw err;
    }

    if (data.baseGroupPrice && data.soloPrice &&
        parseFloat(data.baseGroupPrice) >= parseFloat(data.soloPrice)) {
      const err = new Error('Le prix groupé doit être inférieur au prix solo');
      err.status = 400; throw err;
    }

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k))
    );

    // Repasser en PENDING_APPROVAL après modification si approuvé
    if (product.status === 'APPROVED') updateData.status = 'PENDING_APPROVAL';

    return prisma.product.update({ where: { id: productId }, data: updateData });
  }

  async deleteProduct(productId, userId) {
    const supplier = await getSupplier(userId);

    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });
    if (!product) {
      const err = new Error('Produit introuvable ou accès non autorisé');
      err.status = 404; throw err;
    }

    const activeGroup = await prisma.group.findFirst({
      where: { productId, status: { in: ACTIVE_GROUP_STATUSES } },
    });
    if (activeGroup) {
      const err = new Error('Impossible de supprimer un produit avec un groupe actif');
      err.status = 409; throw err;
    }

    return prisma.product.update({
      where: { id: productId },
      data : { status: 'ARCHIVED' },
    });
  }

  async syncStock(productId, userId, newStock) {
    const supplier = await getSupplier(userId);

    const product = await prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });
    if (!product) {
      const err = new Error('Produit introuvable ou accès non autorisé');
      err.status = 404; throw err;
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data : { stock: parseInt(newStock) },
    });

    // Rupture de stock → annuler les groupes ouverts
    if (parseInt(newStock) === 0) {
      const affectedGroups = await prisma.group.findMany({
        where : { productId, status: { in: ACTIVE_GROUP_STATUSES } },
        select: { id: true },
      });

      if (affectedGroups.length > 0) {
        await prisma.group.updateMany({
          where: { productId, status: { in: ACTIVE_GROUP_STATUSES } },
          data : { status: 'CANCELLED' },
        });

        for (const group of affectedGroups) {
          await notificationService.notifyGroupMembers(group.id, {
            type    : 'GROUP_FAILED',
            title   : '⚠️ Groupe annulé — Rupture de stock',
            body    : `Le groupe pour "${product.name}" a été annulé suite à une rupture de stock. Votre dépôt sera remboursé sous 72h.`,
            channels: ['sms'],
          });
        }
      }
    }

    return updated;
  }
}

module.exports = new ProductsService();