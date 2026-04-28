// ============================================================
// ADMIN SERVICE — Logique métier de l'administration
// Djula Market — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

const auditLog = (adminId, action, entity, entityId, metadata = {}) =>
  prisma.auditLog.create({
    data: { userId: adminId, action, entity, entityId, metadata },
  }).catch(() => {});

const checkNotSelf = (userId, adminId) => {
  if (userId === adminId) {
    const err = new Error('Vous ne pouvez pas modifier votre propre compte');
    err.status = 400; throw err;
  }
};

// ── Sélecteur User aligné avec le schéma Prisma ──────────────
const USER_SELECT = {
  id          : true,
  name        : true,
  phone       : true,
  email       : true,
  role        : true,
  status      : true,
  trustScore  : true,
  city        : true,
  referralCode: true,
  createdAt   : true,
  avatarUrl   : true,
  _count: {
    select: {
      groupMembers  : true,  // ✅ existe dans le schéma
      notifications : true,  // ✅ existe dans le schéma
      payments      : true,  // ✅ existe dans le schéma
      reviews       : true,  // ✅ existe dans le schéma
      disputes      : true,  // ✅ existe dans le schéma
    }
  },
};

class AdminService {

  // ── UTILISATEURS ─────────────────────────────────────────────

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
        { id   : search },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select : USER_SELECT,
        skip,
        take   : limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateUserStatus(userId, adminId, status, reason = null) {
    checkNotSelf(userId, adminId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { const err = new Error('Utilisateur introuvable'); err.status = 404; throw err; }

    const updated = await prisma.user.update({
      where : { id: userId },
      data  : { status },
      select: USER_SELECT,
    });

    await notificationService.notify(userId, {
      type    : 'SYSTEM',
      title   : status === 'ACTIVE' ? 'Compte réactivé' : 'Compte suspendu',
      body    : status === 'ACTIVE'
        ? 'Votre compte Djula Market a été réactivé.'
        : `Votre compte a été suspendu.${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['sms'],
    });

    await auditLog(adminId, 'USER_' + status, 'User', userId, { reason });
    return updated;
  }

  async updateUserRole(userId, adminId, role) {
    checkNotSelf(userId, adminId);
    const updated = await prisma.user.update({
      where : { id: userId },
      data  : { role },
      select: USER_SELECT,
    });
    await auditLog(adminId, 'USER_ROLE_CHANGED', 'User', userId, { role });
    return updated;
  }

  // ── FOURNISSEURS ─────────────────────────────────────────────

  async getSuppliers(query) {
    const { page, limit, skip } = getPagination(query);
    const status = query.status;
    const where  = !status || status === 'ALL' ? {} : { status };
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where, skip, take: limit,
        include: {
          user  : { select: { id: true, name: true, phone: true, email: true, city: true, createdAt: true } },
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
    if (!supplier) { const err = new Error('Fournisseur introuvable'); err.status = 404; throw err; }
    if (supplier.status !== 'PENDING') {
      const err = new Error('Ce fournisseur a déjà été traité'); err.status = 409; throw err;
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
      title   : approved ? '✅ Compte fournisseur approuvé !' : '❌ Dossier fournisseur rejeté',
      body    : approved
        ? 'Félicitations ! Votre compte est activé. Vous pouvez soumettre vos produits.'
        : `Votre dossier a été rejeté.${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['sms', 'email'],
    });

    await auditLog(adminId, approved ? 'SUPPLIER_APPROVED' : 'SUPPLIER_REJECTED', 'Supplier', supplierId, { reason });
    return updated;
  }

  // ── PRODUITS ─────────────────────────────────────────────────

  async getPendingProducts(query) {
    const { page, limit, skip } = getPagination(query);
    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where  : { status: 'PENDING_APPROVAL' },
        skip, take: limit,
        include: {
          category: true,
          supplier: {
            include: {
              user: { select: { name: true, phone: true, email: true, city: true } }
            }
          },
          _count: { select: { groups: true, reviews: true } },
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
      include: { supplier: { include: { user: { select: { id: true } } } } },
    });
    if (!product) { const err = new Error('Produit introuvable'); err.status = 404; throw err; }

    const status  = approved ? 'APPROVED' : 'REJECTED';
    const updated = await prisma.product.update({ where: { id: productId }, data: { status } });

    const userId = product.supplier?.user?.id;
    if (userId) {
      await notificationService.notify(userId, {
        type    : 'SYSTEM',
        title   : approved ? '✅ Produit approuvé !' : '❌ Produit rejeté',
        body    : approved
          ? `Votre produit "${product.name}" est maintenant visible dans le catalogue.`
          : `Votre produit "${product.name}" a été rejeté.${reason ? ` Raison : ${reason}` : ''}`,
        channels: ['email'],
      });
    }

    await auditLog(adminId, approved ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED', 'Product', productId, { reason });
    return updated;
  }

  // ── GROUPES ──────────────────────────────────────────────────

  async getGroups(query) {
    const { page, limit, skip } = getPagination(query);
    const { status, search } = query;
    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { id     : search },
        { product: { name        : { contains: search, mode: 'insensitive' } } },
        { supplier: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where, skip, take: limit,
        include: {
          product     : { include: { category: true } },
          supplier    : { include: { user: { select: { name: true, phone: true } } } },
          pricingTiers: true,
          _count      : { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async closeGroup(groupId, adminId, reason = null) {
    const group = await prisma.group.findUnique({
      where  : { id: groupId },
      include: {
        product: { select: { name: true } },
        members: { where: { status: 'ACTIVE' }, select: { userId: true } },
      },
    });
    if (!group) { const err = new Error('Groupe introuvable'); err.status = 404; throw err; }
    if (['CLOSED', 'CANCELLED', 'FAILED'].includes(group.status)) {
      const err = new Error('Ce groupe est déjà terminé'); err.status = 409; throw err;
    }

    await prisma.group.update({ where: { id: groupId }, data: { status: 'CANCELLED' } });

    for (const member of group.members) {
      await notificationService.notify(member.userId, {
        type    : 'SYSTEM',
        title   : '⚠️ Groupe annulé par l\'administration',
        body    : `Le groupe "${group.product.name}" a été annulé.${reason ? ` Raison : ${reason}` : ''} Vos dépôts seront remboursés sous 72h.`,
        channels: ['sms'],
      });
    }

    await auditLog(adminId, 'GROUP_CANCELLED', 'Group', groupId, { reason });
    return { message: 'Groupe annulé avec succès' };
  }

  // ── LITIGES ──────────────────────────────────────────────────

  async getDisputes(query) {
    const { page, limit, skip } = getPagination(query);
    const { status } = query;
    const where = status && status !== 'ALL' ? { status } : {};
    const [data, total] = await Promise.all([
      prisma.dispute.findMany({
        where, skip, take: limit,
        include: { user: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispute.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async resolveDispute(disputeId, adminId, resolution) {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) { const err = new Error('Litige introuvable'); err.status = 404; throw err; }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data : { status: 'RESOLVED', resolvedBy: adminId, resolution },
    });

    await notificationService.notify(dispute.userId, {
      type    : 'SYSTEM',
      title   : '✅ Litige résolu',
      body    : `Votre litige a été résolu. Décision : ${resolution}`,
      channels: ['sms', 'email'],
    });

    await auditLog(adminId, 'DISPUTE_RESOLVED', 'Dispute', disputeId, { resolution });
    return updated;
  }

  async takeChargeDispute(disputeId, adminId) {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) { const err = new Error('Litige introuvable'); err.status = 404; throw err; }
    if (dispute.status !== 'OPEN') {
      const err = new Error('Ce litige est déjà en cours'); err.status = 409; throw err;
    }
    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data : { status: 'IN_REVIEW', resolvedBy: adminId },
    });
    await auditLog(adminId, 'DISPUTE_TAKEN', 'Dispute', disputeId);
    return updated;
  }

  // ── REMBOURSEMENTS ───────────────────────────────────────────

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
    if (!payment) { const err = new Error('Paiement introuvable'); err.status = 404; throw err; }
    if (payment.status !== 'ESCROWED') {
      const err = new Error('Ce paiement n\'est pas remboursable'); err.status = 409; throw err;
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data : { status: 'REFUNDED' },
    });

    await notificationService.notify(payment.userId, {
      type    : 'SYSTEM',
      title   : '💰 Remboursement effectué',
      body    : `Un remboursement de ${payment.amount.toLocaleString('fr-FR')} XOF a été effectué sur votre compte.`,
      channels: ['sms'],
    });

    await auditLog(adminId, 'REFUND_PROCESSED', 'Payment', paymentId, { amount: payment.amount });
    return updated;
  }

  // ── ANALYTICS ────────────────────────────────────────────────

  async getDashboard() {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [
      totalMembers, activeGroups, successGroups, totalGroups,
      pendingProducts, pendingSuppliers, openDisputes, newMembersToday,
      revenueResult, commissionResult, escrowResult,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
      prisma.group.count({ where: { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } } }),
      prisma.group.count({ where: { status: 'CLOSED' } }),
      prisma.group.count(),
      prisma.product.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.supplier.count({ where: { status: 'PENDING' } }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.payment.aggregate({ where: { status: 'COMPLETED', type: 'FINAL_PAYMENT' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { type: 'COMMISSION', status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'ESCROWED' }, _sum: { amount: true } }),
    ]);

    const successRate = totalGroups > 0
      ? parseFloat(((successGroups / totalGroups) * 100).toFixed(1)) : 0;

    return {
      totalMembers,
      activeGroups,
      totalGroups,
      successRate,
      newMembersToday,
      totalRevenue    : revenueResult._sum.amount    ?? 0,
      totalCommissions: commissionResult._sum.amount ?? 0,
      escrowAmount    : escrowResult._sum.amount     ?? 0,
      pendingProducts,
      pendingSuppliers,
      openDisputes,
    };
  }

  async getGroupsAnalytics() {
    const [byStatus, byCategory] = await Promise.all([
      prisma.group.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.group.groupBy({ by: ['productId'], _count: { id: true } }),
    ]);
    return { byStatus, byCategory };
  }

  async getPaymentsAnalytics() {
    const [byMethod, byType, totalEscrowed] = await Promise.all([
      prisma.payment.groupBy({ by: ['method'], _sum: { amount: true }, _count: { id: true } }),
      prisma.payment.groupBy({ by: ['type'],   _sum: { amount: true }, _count: { id: true } }),
      prisma.payment.aggregate({ where: { status: 'ESCROWED' }, _sum: { amount: true } }),
    ]);
    return { byMethod, byType, totalEscrowed: totalEscrowed._sum.amount ?? 0 };
  }

  // ── MONITORING ───────────────────────────────────────────────

  async getSystemHealth() {
    const dbStart   = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    const mem       = process.memoryUsage();
    return {
      status    : dbLatency < 200 ? 'healthy' : 'degraded',
      timestamp : new Date().toISOString(),
      uptime    : Math.floor(process.uptime()),
      database  : { status: 'connected', latencyMs: dbLatency },
      memory    : {
        heapUsedMB : Math.round(mem.heapUsed  / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB      : Math.round(mem.rss       / 1024 / 1024),
      },
      nodeVersion: process.version,
    };
  }

  // ── AUDIT LOGS ───────────────────────────────────────────────

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
    const [users, groups, payments] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.payment.count(),
    ]);
    await auditLog(adminId, 'GDPR_EXPORT', 'System', 'system', { counts: { users, groups, payments } });
    return { exportedAt: new Date().toISOString(), counts: { users, groups, payments } };
  }
}

module.exports = new AdminService();