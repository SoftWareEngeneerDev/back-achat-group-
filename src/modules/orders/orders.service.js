const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');

class OrdersService {
  async getMyOrders(userId) {
    return prisma.order.findMany({
      where: { group: { members: { some: { userId } } } },
      include: {
        group: { include: { product: { select: { id: true, name: true, imagesUrls: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderTracking(orderId, userId) {
    return prisma.order.findFirst({
      where: { id: orderId, group: { members: { some: { userId } } } },
      select: { id: true, status: true, trackingCode: true, shippedAt: true, deliveredAt: true },
    });
  }

  async getSupplierOrders(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) { const e = new Error('Fournisseur introuvable'); e.status = 404; throw e; }

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where: { group: { supplierId: supplier.id } },
        include: { group: { include: { product: true, members: { where: { status: 'PAID' } } } } },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: { group: { supplierId: supplier.id } } }),
    ]);
    return { data, total, page, limit };
  }

  async confirmOrder(orderId, userId) {
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { supplierId: supplier?.id } },
    });
    if (!order) { const e = new Error('Commande introuvable'); e.status = 404; throw e; }
    return prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });
  }

  async shipOrder(orderId, userId, trackingCode) {
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { supplierId: supplier?.id } },
    });
    if (!order) { const e = new Error('Commande introuvable'); e.status = 404; throw e; }
    return prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED', trackingCode, shippedAt: new Date() },
    });
  }

  async getAllOrders(query) {
    const { page, limit, skip } = getPagination(query);
    const where = query.status ? { status: query.status } : {};
    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where, skip, take: limit,
        include: { group: { include: { product: { select: { name: true } }, supplier: { select: { companyName: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}

module.exports = new OrdersService();
