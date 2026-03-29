// ============================================================
// ADMIN SERVICE — Logique métier de l'administration
// Plateforme Achats Groupés — Burkina Faso
// Couvre : UC27 à UC38 du cahier des charges
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

class AdminService {

  // ──────────────────────────────────────────────────────────
  // UC27 — GESTION DES FOURNISSEURS
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée des fournisseurs selon leur statut.
   * Par défaut retourne les PENDING (en attente de validation).
   */
  async getSuppliers(query) {
    const { page, limit, skip } = getPagination(query);
    const status = query.status || 'PENDING';

    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where: status === 'ALL' ? {} : { status },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, phone: true, email: true, createdAt: true } },
          _count: { select: { products: true, groups: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.supplier.count({
        where: status === 'ALL' ? {} : { status },
      }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC27 — Valider ou rejeter un fournisseur.
   * Si approuvé → met à jour le rôle User en SUPPLIER + notif.
   * Si rejeté → notif avec raison.
   * Crée un audit log dans tous les cas.
   */
  async validateSupplier(supplierId, adminId, approved, reason = null) {
    const status = approved ? 'APPROVED' : 'REJECTED';

    // ── Vérifier que le fournisseur existe et est en attente ─
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { user: { select: { id: true, name: true, phone: true, email: true } } },
    });

    if (!supplier) {
      const err = new Error('Fournisseur introuvable');
      err.status = 404;
      throw err;
    }

    if (supplier.status !== 'PENDING') {
      const err = new Error(`Ce fournisseur a déjà été ${supplier.status === 'APPROVED' ? 'approuvé' : 'traité'}`);
      err.status = 409;
      throw err;
    }

    // ── Mise à jour du statut fournisseur ─────────────────────
    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        status,
        validatedAt: approved ? new Date() : null,
        validatedBy: adminId,
      },
    });

    // ── Si approuvé : promouvoir le rôle utilisateur ──────────
    if (approved) {
      await prisma.user.update({
        where: { id: supplier.userId },
        data: { role: 'SUPPLIER' },
      });
    }

    // ── Notifier le fournisseur ────────────────────────────────
    await notificationService.notify(supplier.userId, {
      type: 'SYSTEM',
      title: approved ? '✅ Compte fournisseur approuvé' : '❌ Demande fournisseur rejetée',
      body: approved
        ? 'Félicitations ! Votre compte fournisseur a été validé. Vous pouvez maintenant ajouter vos produits.'
        : `Votre demande a été rejetée.${reason ? ` Raison : ${reason}` : ''} Contactez le support pour plus d'informations.`,
      channels: ['email', 'sms'],
    });

    // ── Audit log ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `SUPPLIER_${status}`,
        entity: 'Supplier',
        entityId: supplierId,
        metadata: { reason, supplierName: supplier.companyName },
      },
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // UC28 — GESTION DES PRODUITS
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée des produits en attente de validation.
   */
  async getPendingProducts(query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'PENDING_APPROVAL' },
        skip,
        take: limit,
        include: {
          supplier: {
            include: { user: { select: { name: true } } },
          },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.product.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC28 — Approuver ou rejeter un produit.
   * Notifie le fournisseur du résultat + audit log.
   */
  async validateProduct(productId, adminId, approved, reason = null) {
    const status = approved ? 'APPROVED' : 'REJECTED';

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        supplier: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) {
      const err = new Error('Produit introuvable');
      err.status = 404;
      throw err;
    }

    if (product.status !== 'PENDING_APPROVAL') {
      const err = new Error('Ce produit n\'est pas en attente de validation');
      err.status = 409;
      throw err;
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { status },
    });

    // ── Notifier le fournisseur ────────────────────────────────
    await notificationService.notify(product.supplier.userId, {
      type: 'SYSTEM',
      title: approved ? `✅ Produit approuvé : ${product.name}` : `❌ Produit rejeté : ${product.name}`,
      body: approved
        ? `Votre produit "${product.name}" a été approuvé et est maintenant visible sur la plateforme.`
        : `Votre produit "${product.name}" a été rejeté.${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['email'],
    });

    // ── Audit log ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `PRODUCT_${status}`,
        entity: 'Product',
        entityId: productId,
        metadata: { reason, productName: product.name },
      },
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // UC30 — MODÉRATION DES UTILISATEURS
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée de tous les utilisateurs avec filtres.
   */
  async getUsers(query) {
    const { page, limit, skip } = getPagination(query);
    const { status, role, search } = query;

    const where = {};
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, name: true, phone: true, email: true,
          role: true, status: true, trustScore: true,
          createdAt: true,
          _count: { select: { groupMembers: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC30 — Changer le statut d'un utilisateur (suspendre, bannir, activer).
   * Crée un audit log + notifie l'utilisateur.
   */
  async updateUserStatus(userId, adminId, status, reason = null) {
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'BANNED'];
    if (!validStatuses.includes(status)) {
      const err = new Error('Statut invalide');
      err.status = 400;
      throw err;
    }

    // ── Empêcher l'admin de se modifier lui-même ──────────────
    if (userId === adminId) {
      const err = new Error('Impossible de modifier votre propre statut');
      err.status = 400;
      throw err;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404;
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, name: true, phone: true, status: true, role: true },
    });

    // ── Révoquer les sessions si suspendu ou banni ────────────
    if (status === 'SUSPENDED' || status === 'BANNED') {
      await prisma.session.deleteMany({ where: { userId } });
    }

    // ── Notifier l'utilisateur ────────────────────────────────
    const messages = {
      SUSPENDED: 'Votre compte a été temporairement suspendu.',
      BANNED: 'Votre compte a été banni définitivement.',
      ACTIVE: 'Votre compte a été réactivé.',
    };

    await notificationService.notify(userId, {
      type: 'SYSTEM',
      title: 'Information sur votre compte',
      body: `${messages[status]}${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['sms', 'email'],
    });

    // ── Audit log ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: `USER_STATUS_${status}`,
        entity: 'User',
        entityId: userId,
        metadata: { reason, previousStatus: user.status },
      },
    });

    return updated;
  }

  /**
   * UC34 — Modifier le rôle d'un utilisateur.
   */
  async updateUserRole(userId, adminId, role) {
    const validRoles = ['MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN'];
    if (!validRoles.includes(role)) {
      const err = new Error('Rôle invalide');
      err.status = 400;
      throw err;
    }

    if (userId === adminId) {
      const err = new Error('Impossible de modifier votre propre rôle');
      err.status = 400;
      throw err;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404;
      throw err;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, role: true, status: true },
    });

    // ── Audit log ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_ROLE_CHANGED',
        entity: 'User',
        entityId: userId,
        metadata: { previousRole: user.role, newRole: role },
      },
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // UC31 — MODÉRATION DES GROUPES
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée de tous les groupes avec filtres.
   */
  async getGroups(query) {
    const { page, limit, skip } = getPagination(query);
    const { status } = query;

    const where = status ? { status } : {};

    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { name: true, imagesUrls: true } },
          supplier: { include: { user: { select: { name: true } } } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC31 — Fermer un groupe prématurément.
   * Notifie tous les membres actifs.
   */
  async closeGroup(groupId, adminId, reason) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { product: { select: { name: true } } },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404;
      throw err;
    }

    if (!['OPEN', 'THRESHOLD_REACHED'].includes(group.status)) {
      const err = new Error('Ce groupe ne peut pas être fermé (statut actuel : ' + group.status + ')');
      err.status = 409;
      throw err;
    }

    await prisma.group.update({
      where: { id: groupId },
      data: { status: 'CANCELLED' },
    });

    // ── Notifier tous les membres ──────────────────────────────
    await notificationService.notifyGroupMembers(groupId, {
      type: 'GROUP_FAILED',
      title: '⚠️ Groupe annulé par l\'administration',
      body: `Le groupe "${group.product.name}" a été annulé par l'administration.${reason ? ` Raison : ${reason}` : ''} Vos dépôts seront remboursés sous 72h.`,
      channels: ['sms', 'email'],
    });

    // ── Audit log ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'GROUP_CANCELLED',
        entity: 'Group',
        entityId: groupId,
        metadata: { reason },
      },
    });

    return { message: 'Groupe annulé avec succès' };
  }

  // ──────────────────────────────────────────────────────────
  // UC32 — GESTION DES REMBOURSEMENTS
  // ──────────────────────────────────────────────────────────

  /**
   * Liste des paiements en attente de remboursement.
   */
  async getPendingRefunds(query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'ESCROWED', type: 'DEPOSIT' },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, phone: true } },
          group: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.payment.count({ where: { status: 'ESCROWED', type: 'DEPOSIT' } }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC32 — Traiter un remboursement manuellement.
   */
  async processRefund(paymentId, adminId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });

    if (!payment) {
      const err = new Error('Paiement introuvable');
      err.status = 404;
      throw err;
    }

    if (payment.status !== 'ESCROWED') {
      const err = new Error('Ce paiement n\'est pas remboursable (statut : ' + payment.status + ')');
      err.status = 409;
      throw err;
    }

    // ── Mettre à jour le statut paiement ──────────────────────
    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });

    // ── Notifier l'utilisateur ────────────────────────────────
    await notificationService.notify(payment.userId, {
      type: 'SYSTEM',
      title: '💰 Remboursement effectué',
      body: `Un remboursement de ${payment.amount} FCFA a été effectué sur votre compte mobile money.`,
      channels: ['sms'],
    });

    // ── Audit log ─────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'REFUND_PROCESSED',
        entity: 'Payment',
        entityId: paymentId,
        metadata: { amount: payment.amount, userId: payment.userId },
      },
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // UC33 — ANALYTICS & DASHBOARD
  // ──────────────────────────────────────────────────────────

  /**
   * Dashboard principal — KPIs globaux de la plateforme.
   */
  async getDashboard() {
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, activeUsers, newUsersMonth,
      totalGroups, openGroups, successGroups, failedGroups,
      totalOrders, pendingOrders,
      totalProducts, pendingProducts,
      pendingSuppliers,
      revenueResult, commissionResult,
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
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', type: 'FINAL_PAYMENT' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { type: 'COMMISSION', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = revenueResult._sum.amount || 0;
    const totalCommission = commissionResult._sum.amount || 0;
    const successRate = totalGroups > 0
      ? ((successGroups / totalGroups) * 100).toFixed(1)
      : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisMonth: newUsersMonth,
      },
      groups: {
        total: totalGroups,
        open: openGroups,
        success: successGroups,
        failed: failedGroups,
        successRate: `${successRate}%`,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
      },
      products: {
        approved: totalProducts,
        pendingValidation: pendingProducts,
      },
      suppliers: {
        pendingValidation: pendingSuppliers,
      },
      financials: {
        totalRevenue,
        totalCommission,
        estimatedPlatformRevenue: totalRevenue * 0.07,
      },
    };
  }

  /**
   * UC33 — Statistiques des groupes sur 30 jours.
   */
  async getGroupsAnalytics() {
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [byStatus, recentGroups] = await Promise.all([
      prisma.group.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { createdAt: { gte: last30days } },
      }),
      prisma.group.findMany({
        where: { createdAt: { gte: last30days } },
        include: {
          product: { select: { name: true } },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return { byStatus, recentGroups };
  }

  /**
   * UC36 — Statistiques des paiements.
   */
  async getPaymentsAnalytics() {
    const [byMethod, byType, totalEscrowed] = await Promise.all([
      prisma.payment.groupBy({
        by: ['method', 'status'],
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'ESCROWED' },
        _sum: { amount: true },
      }),
    ]);

    return {
      byMethod,
      byType,
      totalEscrowed: totalEscrowed._sum.amount || 0,
    };
  }

  // ──────────────────────────────────────────────────────────
  // UC37 — MONITORING SYSTÈME
  // ──────────────────────────────────────────────────────────

  /**
   * État de santé du système.
   */
  async getSystemHealth() {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    const mem = process.memoryUsage();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        latencyMs: dbLatency,
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      nodeVersion: process.version,
    };
  }

  // ──────────────────────────────────────────────────────────
  // UC38 — AUDIT LOGS
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée des logs d'audit avec filtres.
   */
  async getAuditLogs(query) {
    const { page, limit, skip } = getPagination(query);
    const { action, entity, userId } = query;

    const where = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC38 — Export GDPR : résumé des données de la plateforme.
   */
  async exportGDPR(adminId) {
    const [users, groups, orders, payments] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.order.count(),
      prisma.payment.count(),
    ]);

    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'GDPR_EXPORT',
        entity: 'System',
        metadata: { users, groups, orders, payments },
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      counts: { users, groups, orders, payments },
      message: 'Export GDPR initié. Les données seront envoyées par email.',
    };
  }
}

module.exports = new AdminService();