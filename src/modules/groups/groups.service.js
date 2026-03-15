const prisma = require('../../config/database');
const { getPagination, calculateCurrentPrice, calculateDeposit } = require('../../utils/helpers');
const { PLATFORM_COMMISSION_RATE, MAX_ACTIVE_GROUPS_PER_USER, MIN_TRUST_SCORE } = require('../../config/constants');
const notificationService = require('../notifications/notification.service');

class GroupsService {
  async listGroups(query) {
    const { page, limit, skip } = getPagination(query);
    const where = {};
    if (query.status) where.status = query.status;
    else where.status = 'OPEN';
    if (query.productId) where.productId = query.productId;

    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where, skip, take: limit,
        include: {
          product: { select: { id: true, name: true, imagesUrls: true, soloPrice: true } },
          pricingTiers: { orderBy: { participantCount: 'asc' } },
          _count: { select: { members: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getGroup(id) {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        product: { include: { category: true, supplier: { select: { companyName: true } } } },
        pricingTiers: { orderBy: { participantCount: 'asc' } },
        members: {
          where: { status: 'ACTIVE' },
          select: { id: true, isLeader: true, joinedAt: true }, // Anonymisé
        },
      },
    });
    if (!group) { const e = new Error('Groupe introuvable'); e.status = 404; throw e; }
    return group;
  }

  async createGroup(userId, data, isAdmin = false) {
    const supplier = isAdmin ? null : await prisma.supplier.findFirst({
      where: { userId, status: 'APPROVED' },
    });
    if (!isAdmin && !supplier) { const e = new Error('Fournisseur non validé'); e.status = 403; throw e; }

    const product = await prisma.product.findFirst({
      where: { id: data.productId, status: 'APPROVED' },
    });
    if (!product) { const e = new Error('Produit introuvable ou non approuvé'); e.status = 404; throw e; }
    if (product.stock < data.minParticipants) { const e = new Error('Stock insuffisant pour le seuil minimum'); e.status = 409; throw e; }

    return prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          productId: data.productId,
          supplierId: supplier?.id || null,
          createdByAdmin: isAdmin,
          title: data.title || `Groupe ${product.name}`,
          minParticipants: data.minParticipants,
          maxParticipants: data.maxParticipants,
          currentPrice: product.baseGroupPrice,
          depositPercent: data.depositPercent || 0.1,
          expiresAt: new Date(data.expiresAt),
          pricingTiers: {
            create: data.pricingTiers.map(t => ({
              participantCount: t.participantCount,
              discountPercent: t.discountPercent,
              priceAtTier: product.baseGroupPrice * (1 - t.discountPercent / 100),
            })),
          },
        },
        include: { pricingTiers: true },
      });
      return group;
    });
  }

  async updateGroup(groupId, userId, data, isAdmin = false) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { supplier: true } });
    if (!group) { const e = new Error('Groupe introuvable'); e.status = 404; throw e; }
    if (group.status !== 'OPEN') { const e = new Error('Impossible de modifier un groupe non ouvert'); e.status = 409; throw e; }
    if (!isAdmin && group.supplier?.userId !== userId) { const e = new Error('Non autorisé'); e.status = 403; throw e; }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
        ...(data.maxParticipants && { maxParticipants: data.maxParticipants }),
      },
    });

    await notificationService.notifyGroupMembers(groupId, {
      type: 'SYSTEM',
      title: 'Groupe mis à jour',
      body: 'Les paramètres de votre groupe ont été modifiés.',
    });

    return updated;
  }

  async joinGroup(groupId, userId) {
    const [group, user] = await Promise.all([
      prisma.group.findUnique({ where: { id: groupId }, include: { pricingTiers: true } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!group) { const e = new Error('Groupe introuvable'); e.status = 404; throw e; }
    if (group.status !== 'OPEN') { const e = new Error('Ce groupe n\'est plus ouvert'); e.status = 409; e.code = 'GROUP_CLOSED'; throw e; }
    if (group.currentCount >= group.maxParticipants) { const e = new Error('Groupe complet'); e.status = 409; e.code = 'GROUP_FULL'; throw e; }
    if (user.trustScore < MIN_TRUST_SCORE) { const e = new Error('Score de confiance insuffisant'); e.status = 403; throw e; }

    const existing = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (existing) { const e = new Error('Vous êtes déjà membre de ce groupe'); e.status = 409; e.code = 'ALREADY_MEMBER'; throw e; }

    const activeGroups = await prisma.groupMember.count({
      where: { userId, status: 'ACTIVE', group: { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } } },
    });
    if (activeGroups >= MAX_ACTIVE_GROUPS_PER_USER) {
      const e = new Error(`Maximum ${MAX_ACTIVE_GROUPS_PER_USER} groupes actifs par utilisateur`); e.status = 409; throw e;
    }

    const depositAmount = calculateDeposit(group.currentPrice, group.depositPercent);

    return { group, depositAmount, message: 'Procédez au paiement du dépôt pour rejoindre le groupe' };
  }

  async confirmJoinAfterDeposit(groupId, userId, paymentId) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, include: { pricingTiers: true } });

    return prisma.$transaction(async (tx) => {
      const newCount = group.currentCount + 1;
      const newPrice = calculateCurrentPrice(group.pricingTiers, newCount) || group.currentPrice;

      const [member, updatedGroup] = await Promise.all([
        tx.groupMember.create({
          data: { groupId, userId, depositPaid: calculateDeposit(group.currentPrice, group.depositPercent) },
        }),
        tx.group.update({
          where: { id: groupId },
          data: {
            currentCount: newCount,
            currentPrice: newPrice,
            ...(newCount >= group.minParticipants && { status: 'THRESHOLD_REACHED', reachedAt: new Date() }),
          },
          include: { pricingTiers: true },
        }),
      ]);

      // Notifier tous les membres
      await notificationService.notifyGroupMembers(groupId, {
        type: 'NEW_MEMBER',
        title: 'Nouveau membre !',
        body: `Le groupe compte maintenant ${newCount} membres. Prix actuel : ${newPrice.toLocaleString()} XOF`,
      });

      if (updatedGroup.status === 'THRESHOLD_REACHED') {
        await notificationService.notifyGroupMembers(groupId, {
          type: 'GROUP_SUCCESS',
          title: '🎉 Seuil atteint !',
          body: `Procédez au paiement du solde pour finaliser votre achat. Prix final : ${newPrice.toLocaleString()} XOF`,
        });
      }

      // Émettre via Socket.io
      const io = require('../../sockets/socket').getIO();
      io.to(`group:${groupId}`).emit('group:member_joined', {
        groupId, newCount, newPrice, status: updatedGroup.status,
      });

      return { member, group: updatedGroup };
    });
  }

  async leaveGroup(groupId, userId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });

    if (!member) { const e = new Error('Vous n\'êtes pas membre de ce groupe'); e.status = 404; throw e; }
    if (member.group.status !== 'OPEN') { const e = new Error('Impossible de quitter un groupe après le seuil'); e.status = 409; throw e; }

    return prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId } },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      const newCount = Math.max(0, member.group.currentCount - 1);
      await tx.group.update({ where: { id: groupId }, data: { currentCount: newCount } });

      // Marquer le dépôt comme remboursé
      await tx.payment.updateMany({
        where: { groupMemberId: member.id, type: 'DEPOSIT', status: 'ESCROWED' },
        data: { status: 'REFUNDED' },
      });

      return { refundAmount: member.depositPaid };
    });
  }

  async getGroupProgress(groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, currentCount: true, minParticipants: true, maxParticipants: true, currentPrice: true, status: true, expiresAt: true },
    });
    if (!group) { const e = new Error('Groupe introuvable'); e.status = 404; throw e; }
    return {
      ...group,
      completionPercent: Math.round((group.currentCount / group.minParticipants) * 100),
      spotsLeft: group.maxParticipants - group.currentCount,
    };
  }

  // Admin
  async closeGroup(groupId, adminId) {
    const group = await prisma.group.update({
      where: { id: groupId },
      data: { status: 'CANCELLED', closedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'GROUP_CLOSED_BY_ADMIN', entity: 'Group', entityId: groupId },
    });
    return group;
  }

  // CRON : expiration des groupes
  async expireFailedGroups() {
    const expired = await prisma.group.findMany({
      where: { status: 'OPEN', expiresAt: { lt: new Date() } },
      include: { members: { where: { status: 'ACTIVE' } } },
    });

    for (const group of expired) {
      await prisma.$transaction(async (tx) => {
        await tx.group.update({ where: { id: group.id }, data: { status: 'FAILED' } });
        await tx.payment.updateMany({
          where: {
            groupMember: { groupId: group.id },
            type: 'DEPOSIT', status: 'ESCROWED',
          },
          data: { status: 'REFUNDED' },
        });
      });

      await notificationService.notifyGroupMembers(group.id, {
        type: 'GROUP_FAILED',
        title: 'Groupe échoué',
        body: 'Le groupe n\'a pas atteint son seuil. Votre dépôt sera remboursé dans 72h.',
      });
    }

    return expired.length;
  }
}

module.exports = new GroupsService();
