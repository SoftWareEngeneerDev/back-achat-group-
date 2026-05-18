// ============================================================
// ORDERS SERVICE — Logique métier des commandes
// Djula Market — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

// ── Sélections réutilisables ─────────────────────────────────
const ORDER_INCLUDE = {
  group: {
    include: {
      product : { select: { id: true, name: true, imagesUrls: true } },
      supplier: { select: { id: true, companyName: true } },
    },
  },
};

// ── Helper fournisseur ────────────────────────────────────────
const getSupplier = async (userId) => {
  const supplier = await prisma.supplier.findFirst({ where: { userId } });
  if (!supplier) {
    const err = new Error('Profil fournisseur introuvable');
    err.status = 403; throw err;
  }
  return supplier;
};

class OrdersService {

  // ──────────────────────────────────────────────────────────
  // MEMBRE
  // ──────────────────────────────────────────────────────────

  /**
   * Commandes de l'utilisateur connecté
   */
  async getMyOrders(userId) {
    return prisma.order.findMany({
      where  : { group: { members: { some: { userId } } } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Détail + suivi d'une commande spécifique
   */
  async getOrderById(orderId, userId) {
    const order = await prisma.order.findFirst({
      where  : { id: orderId, group: { members: { some: { userId } } } },
      include: {
        ...ORDER_INCLUDE,
        group: {
          include: {
            product : { select: { id: true, name: true, imagesUrls: true } },
            supplier: { select: { id: true, companyName: true, phone: true } },
          },
        },
      },
    });

    if (!order) {
      const err = new Error('Commande introuvable');
      err.status = 404; throw err;
    }

    return order;
  }

  /**
   * Confirmer la réception d'une commande (membre)
   * Déclenche la libération du paiement au fournisseur
   */
  async confirmDelivery(orderId, userId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { members: { some: { userId } } } },
    });

    if (!order) {
      const err = new Error('Commande introuvable');
      err.status = 404; throw err;
    }

    if (order.status !== 'SHIPPED') {
      const err = new Error('La commande doit être expédiée avant de confirmer la réception');
      err.status = 409; throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data : { status: 'DELIVERED', deliveredAt: new Date() },
    });

    // Déclencher la libération du paiement escrow vers le fournisseur
    const paymentsService = require('../payments/payments.service');
    paymentsService.releaseEscrow(order.groupId).catch((err) => {
      const logger = require('../../utils/logger');
      logger.error('[ESCROW] Échec libération escrow:', err.message);
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // FOURNISSEUR
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée des commandes du fournisseur
   */
  async getSupplierOrders(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const supplier = await getSupplier(userId);

    const where = { group: { supplierId: supplier.id } };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          group: {
            include: {
              product: true,
              members: { where: { status: 'PAID' }, select: { userId: true } },
            },
          },
        },
        skip,
        take   : limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Confirmer la prise en charge d'une commande → PROCESSING
   */
  async confirmOrder(orderId, userId) {
    const supplier = await getSupplier(userId);

    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { supplierId: supplier.id } },
    });

    if (!order) {
      const err = new Error('Commande introuvable ou accès non autorisé');
      err.status = 404; throw err;
    }

    if (order.status !== 'CREATED') {
      const err = new Error('Cette commande a déjà été prise en charge');
      err.status = 409; throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data : { status: 'PROCESSING', confirmedAt: new Date() },
    });

    await notificationService.notifyGroupMembers(order.groupId, {
      type    : 'DELIVERY_UPDATE',
      title   : '📦 Commande confirmée',
      body    : 'Le fournisseur a confirmé votre commande. Préparation en cours.',
      channels: ['push'],
    });

    return updated;
  }

  /**
   * Marquer une commande comme expédiée → SHIPPED
   */
  async shipOrder(orderId, userId, trackingCode) {
    const supplier = await getSupplier(userId);

    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { supplierId: supplier.id } },
    });

    if (!order) {
      const err = new Error('Commande introuvable ou accès non autorisé');
      err.status = 404; throw err;
    }

    if (order.status !== 'PROCESSING') {
      const err = new Error('La commande doit être en traitement avant d\'être expédiée');
      err.status = 409; throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data : { status: 'SHIPPED', trackingCode, shippedAt: new Date() },
    });

    await notificationService.notifyGroupMembers(order.groupId, {
      type    : 'DELIVERY_UPDATE',
      title   : '🚚 Commande expédiée !',
      body    : `Votre commande est en route ! Code de suivi : ${trackingCode}`,
      channels: ['sms', 'push'],
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // ADMIN
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée de toutes les commandes
   */
  async getAllOrders(query) {
    const { page, limit, skip } = getPagination(query);
    const where = {};
    if (query.status)     where.status = query.status;
    if (query.supplierId) where.group  = { supplierId: query.supplierId };
    if (query.userId)     where.group  = { ...(where.group ?? {}), members: { some: { userId: query.userId } } };

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take   : limit,
        include: {
          group: {
            include: {
              product : { select: { name: true } },
              supplier: { select: { companyName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Forcer le statut d'une commande (admin)
   */
  async updateOrderStatus(orderId, status) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      const err = new Error('Commande introuvable');
      err.status = 404; throw err;
    }

    return prisma.order.update({
      where: { id: orderId },
      data : { status },
    });
  }
}

module.exports = new OrdersService();