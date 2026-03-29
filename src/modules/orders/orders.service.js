// ============================================================
// ORDERS SERVICE — Logique métier des commandes
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

class OrdersService {

  // ──────────────────────────────────────────────────────────
  // MEMBRE — Ses commandes
  // ──────────────────────────────────────────────────────────

  /**
   * UC16 — Commandes de l'utilisateur connecté.
   */
  async getMyOrders(userId) {
    return prisma.order.findMany({
      where: { group: { members: { some: { userId } } } },
      include: {
        group: {
          include: {
            product: { select: { id: true, name: true, imagesUrls: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * UC16 — Suivi d'une commande spécifique.
   */
  async getOrderTracking(orderId, userId) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        group: { members: { some: { userId } } },
      },
      select: {
        id: true,
        status: true,
        trackingCode: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
        group: {
          select: {
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      const err = new Error('Commande introuvable');
      err.status = 404;
      throw err;
    }

    return order;
  }

  // ──────────────────────────────────────────────────────────
  // FOURNISSEUR — Ses commandes
  // ──────────────────────────────────────────────────────────

  /**
   * UC25 — Liste paginée des commandes du fournisseur.
   */
  async getSupplierOrders(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 404;
      throw err;
    }

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
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC25 — Confirmer la prise en charge d'une commande.
   * Passe le statut de CREATED à PROCESSING.
   */
  async confirmOrder(orderId, userId) {
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403;
      throw err;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { supplierId: supplier.id } },
    });

    if (!order) {
      const err = new Error('Commande introuvable ou accès non autorisé');
      err.status = 404;
      throw err;
    }

    if (order.status !== 'CREATED') {
      const err = new Error('Cette commande a déjà été confirmée');
      err.status = 409;
      throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PROCESSING' },
    });

    // ── Notifier les membres ───────────────────────────────
    await notificationService.notifyGroupMembers(order.groupId, {
      type: 'DELIVERY_UPDATE',
      title: '📦 Commande en cours de traitement',
      body: 'Le fournisseur a confirmé votre commande. Préparation en cours.',
      channels: ['push'],
    });

    return updated;
  }

  /**
   * UC25 — Marquer une commande comme expédiée avec code de suivi.
   */
  async shipOrder(orderId, userId, trackingCode) {
    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403;
      throw err;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, group: { supplierId: supplier.id } },
    });

    if (!order) {
      const err = new Error('Commande introuvable ou accès non autorisé');
      err.status = 404;
      throw err;
    }

    if (order.status !== 'PROCESSING') {
      const err = new Error('La commande doit être en traitement avant d\'être expédiée');
      err.status = 409;
      throw err;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED', trackingCode, shippedAt: new Date() },
    });

    // ── Notifier les membres avec le code de suivi ─────────
    await notificationService.notifyGroupMembers(order.groupId, {
      type: 'DELIVERY_UPDATE',
      title: '🚚 Commande expédiée !',
      body: `Votre commande est en route ! Code de suivi : ${trackingCode}`,
      channels: ['sms', 'push'],
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // ADMIN — Toutes les commandes
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée de toutes les commandes avec filtres.
   */
  async getAllOrders(query) {
    const { page, limit, skip } = getPagination(query);
    const where = {};
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          group: {
            include: {
              product: { select: { name: true } },
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
}

module.exports = new OrdersService();