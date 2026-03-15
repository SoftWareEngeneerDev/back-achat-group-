const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');

class ProductsService {
  async listProducts(query) {
    const { page, limit, skip } = getPagination(query);
    const where = { status: 'APPROVED' };
    if (query.category) where.categoryId = query.category;
    if (query.minPrice) where.soloPrice = { gte: parseFloat(query.minPrice) };
    if (query.maxPrice) where.soloPrice = { ...where.soloPrice, lte: parseFloat(query.maxPrice) };
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    const orderBy = {};
    if (query.sort === 'price_asc') orderBy.soloPrice = 'asc';
    else if (query.sort === 'price_desc') orderBy.soloPrice = 'desc';
    else orderBy.createdAt = 'desc';

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where, skip, take: limit, orderBy,
        select: {
          id: true, name: true, soloPrice: true, baseGroupPrice: true,
          stock: true, imagesUrls: true,
          category: { select: { id: true, name: true } },
          supplier: { select: { companyName: true } },
          _count: { select: { reviews: true, groups: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getProduct(id) {
    return prisma.product.findFirst({
      where: { id, status: 'APPROVED' },
      include: {
        category: true,
        supplier: { select: { companyName: true, id: true } },
        reviews: {
          take: 5, orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
        groups: {
          where: { status: 'OPEN' },
          select: { id: true, title: true, currentCount: true, minParticipants: true, currentPrice: true, expiresAt: true },
        },
        _count: { select: { reviews: true } },
      },
    });
  }

  async listCategories() {
    return prisma.category.findMany({
      where: { parentId: null },
      include: { children: true },
      orderBy: { name: 'asc' },
    });
  }

  // Fournisseur
  async createProduct(supplierId, data) {
    const supplier = await prisma.supplier.findFirst({ where: { userId: supplierId, status: 'APPROVED' } });
    if (!supplier) { const e = new Error('Fournisseur non validé'); e.status = 403; throw e; }

    return prisma.product.create({
      data: {
        supplierId: supplier.id,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        soloPrice: data.soloPrice,
        baseGroupPrice: data.baseGroupPrice,
        stock: data.stock,
        imagesUrls: data.imagesUrls || [],
        status: 'DRAFT',
      },
    });
  }

  async updateProduct(productId, supplierId, data) {
    const supplier = await prisma.supplier.findFirst({ where: { userId: supplierId } });
    const product = await prisma.product.findFirst({ where: { id: productId, supplierId: supplier?.id } });
    if (!product) { const e = new Error('Produit introuvable'); e.status = 404; throw e; }

    const allowed = ['name', 'description', 'soloPrice', 'baseGroupPrice', 'stock', 'imagesUrls', 'categoryId'];
    const updateData = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));

    return prisma.product.update({ where: { id: productId }, data: updateData });
  }

  async deleteProduct(productId, supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { userId: supplierId } });
    const product = await prisma.product.findFirst({ where: { id: productId, supplierId: supplier?.id } });
    if (!product) { const e = new Error('Produit introuvable'); e.status = 404; throw e; }

    const activeGroup = await prisma.group.findFirst({ where: { productId, status: 'OPEN' } });
    if (activeGroup) { const e = new Error('Impossible de supprimer un produit avec un groupe actif'); e.status = 409; throw e; }

    return prisma.product.update({ where: { id: productId }, data: { status: 'ARCHIVED' } });
  }

  async syncStock(productId, supplierId, newStock) {
    const supplier = await prisma.supplier.findFirst({ where: { userId: supplierId } });
    const product = await prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    if (newStock === 0) {
      await prisma.group.updateMany({
        where: { productId, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      });
    }
    return product;
  }

  // Admin
  async getPendingProducts(query) {
    const { page, limit, skip } = getPagination(query);
    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'PENDING_APPROVAL' }, skip, take: limit,
        include: { supplier: { select: { companyName: true } }, category: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.product.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);
    return { data, total, page, limit };
  }

  async approveProduct(productId, adminId, approved, reason) {
    const status = approved ? 'APPROVED' : 'REJECTED';
    const product = await prisma.product.update({
      where: { id: productId },
      data: { status, approvedAt: approved ? new Date() : null, approvedBy: adminId },
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: `PRODUCT_${status}`, entity: 'Product', entityId: productId, metadata: { reason } },
    });
    return product;
  }
}

module.exports = new ProductsService();
