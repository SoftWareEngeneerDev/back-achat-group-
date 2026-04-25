// ============================================================
// ADMIN SERVICE — Logique métier de l'administration
// Djula Market — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

// ── Helper : créer un audit log ──────────────────────────────
const auditLog = (adminId, action, entity, entityId, metadata = {}) =>
  prisma.auditLog.create({
    data: { userId: adminId, action, entity, entityId, metadata },
  });

// ── Helper : bloquer l'auto-modification ─────────────────────
const checkNotSelf = (userId, adminId, label) => {
  if (userId === adminId) {
    const err = new Error(label); err.status = 400; throw err;
  }
};

class AdminService {

  // ──────────────────────────────────────────────────────────
  // FOURNISSEURS
  // ──────────────────────────────────────────────────────────

  async getSuppliers(query) {
    const { page, limit, skip } = getPagination(query);
    const status = query.status || 'PENDING';
    const where  = status === 'ALL' ? {} : { status };

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where, skip, take: limit,
        include: {
          user  : { select: { name: true, phone: true, email: true, createdAt: true } },
          _count: { select: { products: true, groups: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async validateSupplier(supplierId, adminId, approved, reason = null) {
    const supplier = await prisma.supplier.findUnique({
      where  : { id: supplierId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!supplier) {
      const err = new Error('Fournisseur introuvable'); err.status = 404; throw err;
    }
    if (supplier.status !== 'PENDING') {
      const err = new Error(`Ce fournisseur a déjà été ${supplier.status === 'APPROVED' ? 'approuvé' : 'traité'}`);
      err.status = 409; throw err;
    }

    const status  = approved ? 'APPROVED' : 'REJECTED';
    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data : { status, validatedAt: approved ? new Date() : null, validatedBy: adminId },
    });

    if (approved) {
      await prisma.user.update({
        where: { id: supplier.userId },
        data : { role: 'SUPPLIER', status: 'ACTIVE' },
      });
    }

    await notificationService.notify(supplier.userId, {
      type    : 'SYSTEM',
      title   : approved ? '✅ Compte fournisseur approuvé' : '❌ Demande fournisseur rejetée',
      body    : approved
        ? 'Félicitations ! Votre compte fournisseur a été validé. Vous pouvez maintenant ajouter vos produits.'
        : `Votre demande a été rejetée.${reason ? ` Raison : ${reason}` : ''} Contactez le support.`,
      channels: ['email', 'sms'],
    });

    await auditLog(adminId, `SUPPLIER_${status}`, 'Supplier', supplierId, {
      reason, supplierName: supplier.companyName,
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // PRODUITS
  // ──────────────────────────────────────────────────────────

  async getPendingProducts(query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where  : { status: 'PENDING_APPROVAL' },
        skip, take: limit,
        include: {
          supplier: { include: { user: { select: { name: true } } } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.product.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);

    return { data, total, page, limit };
  }

  async validateProduct(productId, adminId, approved, reason = null) {
    const product = await prisma.product.findUnique({
      where  : { id: productId },
      include: { supplier: { select: { userId: true } } },
    });

    if (!product) {
      const err = new Error('Produit introuvable'); err.status = 404; throw err;
    }
    if (product.status !== 'PENDING_APPROVAL') {
      const err = new Error('Ce produit n\'est pas en attente de validation');
      err.status = 409; throw err;
    }

    const status  = approved ? 'APPROVED' : 'REJECTED';
    const updated = await prisma.product.update({ where: { id: productId }, data: { status } });

    await notificationService.notify(product.supplier.userId, {
      type    : 'SYSTEM',
      title   : approved ? `✅ Produit approuvé : ${product.name}` : `❌ Produit rejeté : ${product.name}`,
      body    : approved
        ? `Votre produit "${product.name}" est maintenant visible dans le catalogue.`
        : `Votre produit "${product.name}" a été rejeté.${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['email'],
    });

    await auditLog(adminId, `PRODUCT_${status}`, 'Product', productId, {
      reason, productName: product.name,
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // UTILISATEURS
  // ──────────────────────────────────────────────────────────

  async getUsers(query) {
    const { page, limit, skip } = getPagination(query);
    const { status, role, search } = query;

    const where = {};
    if (status) where.status = status;
    if (role)   where.role   = role;
    if (search) {
      where.OR = [
        { name : { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        select : {
          id: true, name: true, phone: true, email: true,
          role: true, status: true, trustScore: true, createdAt: true,
          _count: { select: { groupMembers: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updateUserStatus(userId, adminId, status, reason = null) {
    checkNotSelf(userId, adminId, 'Impossible de modifier votre propre statut');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err = new Error('Utilisateur introuvable'); err.status = 404; throw err;
    }

    const updated = await prisma.user.update({
      where : { id: userId },
      data  : { status },
      select: { id: true, name: true, phone: true, status: true, role: true },
    });

    if (['SUSPENDED', 'BANNED'].includes(status)) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    const messages = {
      SUSPENDED: 'Votre compte a été temporairement suspendu.',
      BANNED   : 'Votre compte a été banni définitivement.',
      ACTIVE   : 'Votre compte a été réactivé.',
    };

    await notificationService.notify(userId, {
      type    : 'SYSTEM',
      title   : 'Information sur votre compte',
      body    : `${messages[status]}${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['sms', 'email'],
    });

    await auditLog(adminId, `USER_STATUS_${status}`, 'User', userId, {
      reason, previousStatus: user.status,
    });

    return updated;
  }

  async updateUserRole(userId, adminId, role) {
    checkNotSelf(userId, adminId, 'Impossible de modifier votre propre rôle');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err = new Error('Utilisateur introuvable'); err.status = 404; throw err;
    }

    const updated = await prisma.user.update({
      where : { id: userId },
      data  : { role },
      select: { id: true, name: true, role: true, status: true },
    });

    await auditLog(adminId, 'USER_ROLE_CHANGED', 'User', userId, {
      previousRole: user.role, newRole: role,
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // GROUPES
  // ──────────────────────────────────────────────────────────

  async getGroups(query) {
    const { page, limit, skip } = getPagination(query);
    const where = query.status ? { status: query.status } : {};

    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where, skip, take: limit,
        include: {
          product : { select: { name: true, imagesUrls: true } },
          supplier: { include: { user: { select: { name: true } } } },
          _count  : { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async closeGroup(groupId, adminId, reason) {
    const group = await prisma.group.findUnique({
      where  : { id: groupId },
      include: { product: { select: { name: true } } },
    });

    if (!group) {
      const err = new Error('Groupe introuvable'); err.status = 404; throw err;
    }
    if (!['OPEN', 'THRESHOLD_REACHED'].includes(group.status)) {
      const err = new Error(`Ce groupe ne peut pas être fermé (statut : ${group.status})`);
      err.status = 409; throw err;
    }

    await prisma.group.update({ where: { id: groupId }, data: { status: 'CANCELLED' } });

    await notificationService.notifyGroupMembers(groupId, {
      type    : 'GROUP_FAILED',
      title   : '⚠️ Groupe annulé par l\'administration',
      body    : `Le groupe "${group.product.name}" a été annulé.${reason ? ` Raison : ${reason}` : ''} Vos dépôts seront remboursés sous 72h.`,
      channels: ['sms', 'email'],
    });

    await auditLog(adminId, 'GROUP_CANCELLED', 'Group', groupId, { reason });

    return { message: 'Groupe annulé avec succès' };
  }

  // ──────────────────────────────────────────────────────────
  // REMBOURSEMENTS
  // ──────────────────────────────────────────────────────────

  async getPendingRefunds(query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where  : { status: 'ESCROWED', type: 'DEPOSIT' },
        skip, take: limit,
        include: {
          user : { select: { name: true, phone: true } },
          group: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.payment.count({ where: { status: 'ESCROWED', type: 'DEPOSIT' } }),
    ]);

    return { data, total, page, limit };
  }

  async processRefund(paymentId, adminId) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      const err = new Error('Paiement introuvable'); err.status = 404; throw err;
    }
    if (payment.status !== 'ESCROWED') {
      const err = new Error(`Ce paiement n\'est pas remboursable (statut : ${payment.status})`);
      err.status = 409; throw err;
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data : { status: 'REFUNDED' },
    });

    await notificationService.notify(payment.userId, {
      type    : 'SYSTEM',
      title   : '💰 Remboursement effectué',
      body    : `Un remboursement de ${payment.amount.toLocaleString()} FCFA a été effectué sur votre compte.`,
      channels: ['sms'],
    });

    await auditLog(adminId, 'REFUND_PROCESSED', 'Payment', paymentId, {
      amount: payment.amount, userId: payment.userId,
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // ANALYTICS
  // ──────────────────────────────────────────────────────────

  async getDashboard() {
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, activeUsers, newUsersMonth,
      totalGroups, openGroups, successGroups, failedGroups,
      totalOrders, pendingOrders,
      totalProducts, pendingProducts,
      pendingSuppliers,
      revenueResult, commissionResult, escrowResult,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: last30days } } }),
      prisma.group.count(),
      prisma.group.count({ where: { status: 'OPEN' } }),
      prisma.group.count({ where: { status: 'CLOSED' } }),
      prisma.group.count({ where: { status: 'FAILED' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PROCESSING' } }),
      prisma.product.count({ where: { status: 'APPROVED' } }),
      prisma.product.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.supplier.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED', type: 'FINAL_PAYMENT' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { type: 'COMMISSION', status: 'COMPLETED' },    _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'ESCROWED' },                         _sum: { amount: true } }),
    ]);

    const successRate = totalGroups > 0
      ? parseFloat(((successGroups / totalGroups) * 100).toFixed(1)) : 0;

    return {
      users    : { total: totalUsers, active: activeUsers, newThisMonth: newUsersMonth },
      groups   : { total: totalGroups, open: openGroups, success: successGroups, failed: failedGroups, successRate },
      orders   : { total: totalOrders, pending: pendingOrders },
      products : { total: totalProducts, pending: pendingProducts },
      suppliers: { pending: pendingSuppliers },
      finances : {
        totalRevenue    : revenueResult._sum.amount    ?? 0,
        totalCommissions: commissionResult._sum.amount ?? 0,
        escrowAmount    : escrowResult._sum.amount     ?? 0,
      },
    };
  }

  async getGroupsAnalytics() {
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [byStatus, recentGroups] = await Promise.all([
      prisma.group.groupBy({ by: ['status'], _count: { id: true }, where: { createdAt: { gte: last30days } } }),
      prisma.group.findMany({
        where  : { createdAt: { gte: last30days } },
        include: { product: { select: { name: true } }, _count: { select: { members: true } } },
        orderBy: { createdAt: 'desc' },
        take   : 10,
      }),
    ]);

    return { byStatus, recentGroups };
  }

  async getPaymentsAnalytics() {
    const [byMethod, byType, totalEscrowed] = await Promise.all([
      prisma.payment.groupBy({ by: ['method', 'status'], _sum: { amount: true }, _count: { id: true } }),
      prisma.payment.groupBy({ by: ['type'],             _sum: { amount: true }, _count: { id: true } }),
      prisma.payment.aggregate({ where: { status: 'ESCROWED' }, _sum: { amount: true } }),
    ]);

    return { byMethod, byType, totalEscrowed: totalEscrowed._sum.amount ?? 0 };
  }

  // ──────────────────────────────────────────────────────────
  // MONITORING
  // ──────────────────────────────────────────────────────────

  async getSystemHealth() {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    const mem = process.memoryUsage();

    return {
      status     : dbLatency < 200 ? 'healthy' : 'degraded',
      timestamp  : new Date().toISOString(),
      uptime     : Math.floor(process.uptime()),
      database   : { status: 'connected', latencyMs: dbLatency },
      memory     : {
        heapUsedMB : Math.round(mem.heapUsed  / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB      : Math.round(mem.rss       / 1024 / 1024),
      },
      nodeVersion: process.version,
    };
  }

  // ──────────────────────────────────────────────────────────
  // AUDIT LOGS
  // ──────────────────────────────────────────────────────────

  async getAuditLogs(query) {
    const { page, limit, skip } = getPagination(query);
    const { action, entity, userId } = query;

    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take: limit,
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async exportGDPR(adminId) {
    const [users, groups, orders, payments] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.order.count(),
      prisma.payment.count(),
    ]);

    await auditLog(adminId, 'GDPR_EXPORT', 'System', 'system', {
      counts: { users, groups, orders, payments },
    });

    return {
      exportedAt: new Date().toISOString(),
      counts    : { users, groups, orders, payments },
      message   : 'Export GDPR initié.',
    };
  }
}

module.exports = new AdminService();