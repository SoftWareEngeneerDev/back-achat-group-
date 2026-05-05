// ============================================================
// GROUPS SERVICE — Logique métier des groupes d'achat
// Djula Market — Burkina Faso
// CŒUR DU PROJET : tarification dynamique, escrow, WebSockets
// ============================================================

const prisma = require('../../config/database');
const {
  getPagination,
  calculateCurrentPrice,
  calculateDeposit,
  getNextTier,
  progressPercent,
  isExpired,
} = require('../../utils/helpers');
const {
  PLATFORM_COMMISSION_RATE,
  MAX_ACTIVE_GROUPS_PER_USER,
  MIN_TRUST_SCORE,
} = require('../../config/constants');
const notificationService = require('../notifications/notification.service');

// ── Sélections réutilisables ─────────────────────────────────
const GROUP_INCLUDE = {
  product     : { select: { id: true, name: true, imagesUrls: true, soloPrice: true } },
  supplier    : { select: { id: true, companyName: true, rating: true, city: true,
                    user: { select: { name: true, phone: true } } } },
  pricingTiers: { orderBy: { participantCount: 'asc' } },
  _count      : { select: { members: { where: { status: 'ACTIVE' } } } },
};

const GROUP_DETAIL_INCLUDE = {
  product: {
    include: {
      category: true,
      supplier: { select: { companyName: true, rating: true } },
    },
  },
  supplier: {
    select: {
      id         : true,
      companyName: true,
      rating     : true,
      city       : true,
      description: true,
      user       : { select: { name: true, phone: true } },
    },
  },
  pricingTiers: { orderBy: { participantCount: 'asc' } },
  members: {
    where : { status: 'ACTIVE' },
    select: { id: true, isLeader: true, joinedAt: true }, // anonymisés
  },
};

// ── Émettre un événement WebSocket (non bloquant) ────────────
const emitSocket = (room, event, data) => {
  try {
    const io = require('../../sockets/socket').getIO();
    io.to(room).emit(event, data);
  } catch {
    // Socket.io non critique
  }
};

class GroupsService {

  // ──────────────────────────────────────────────────────────
  // ROUTES PUBLIQUES
  // ──────────────────────────────────────────────────────────

  /**
   * Liste paginée des groupes actifs avec filtres
   */
  async listGroups(query) {
    const { page, limit, skip } = getPagination(query);

    const where = { status: query.status || 'OPEN' };
    if (query.productId)   where.productId   = query.productId;
    if (query.supplierId)  where.supplierId  = query.supplierId;
    if (query.categoryId) {
      where.product = { categoryId: query.categoryId };
    }

    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take    : limit,
        include : GROUP_INCLUDE,
        orderBy : [
          { status: 'asc' },       // THRESHOLD_REACHED en premier
          { createdAt: 'desc' },
        ],
      }),
      prisma.group.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Détail complet d'un groupe (membres anonymisés, paliers)
   */
  async getGroup(id) {
    const group = await prisma.group.findUnique({
      where  : { id },
      include: GROUP_DETAIL_INCLUDE,
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404; throw err;
    }

    return group;
  }

  /**
   * Progression en temps réel du groupe
   */
  async getGroupProgress(groupId) {
    const group = await prisma.group.findUnique({
      where : { id: groupId },
      select: {
        id: true, currentCount: true, minParticipants: true,
        maxParticipants: true, currentPrice: true, status: true,
        expiresAt: true,
        pricingTiers: { orderBy: { participantCount: 'asc' } },
      },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404; throw err;
    }

    const nextTier = getNextTier(group.pricingTiers, group.currentCount);

    return {
      ...group,
      completionPercent : progressPercent(group.currentCount, group.minParticipants),
      spotsLeft         : group.maxParticipants - group.currentCount,
      thresholdReached  : group.currentCount >= group.minParticipants,
      timeLeftMs        : Math.max(0, new Date(group.expiresAt) - new Date()),
      nextTier,
    };
  }

  // ──────────────────────────────────────────────────────────
  // CRÉATION ET MODIFICATION
  // ──────────────────────────────────────────────────────────


  /**
   * Groupes créés par le fournisseur connecté
   */
  async getMyGroups(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const supplier = await prisma.supplier.findFirst({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 403; throw err;
    }

    const where = { supplierId: supplier.id };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take   : limit,
        include: {
          product     : { select: { id: true, name: true, imagesUrls: true, soloPrice: true } },
          pricingTiers: { orderBy: { participantCount: 'asc' } },
          _count      : { select: { members: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Créer un groupe d'achat (fournisseur ou admin)
   */
  async createGroup(userId, data, isAdmin = false) {
    // Vérifier le fournisseur
    let supplier = null;
    if (!isAdmin) {
      supplier = await prisma.supplier.findFirst({
        where: { userId, status: 'APPROVED' },
      });
      if (!supplier) {
        const err = new Error('Votre compte fournisseur n\'est pas encore validé');
        err.status = 403; throw err;
      }
    }

    // Vérifier le produit
    const product = await prisma.product.findFirst({
      where: { id: data.productId, status: 'APPROVED' },
    });
    if (!product) {
      const err = new Error('Produit introuvable ou non approuvé');
      err.status = 404; throw err;
    }

    // Vérifier stock suffisant
    if (product.stock < data.minParticipants) {
      const err = new Error('Stock insuffisant pour le seuil minimum de participants');
      err.status = 409; throw err;
    }

    // Vérifier cohérence des paramètres
    if (data.minParticipants >= data.maxParticipants) {
      const err = new Error('Le seuil minimum doit être inférieur au maximum');
      err.status = 400; throw err;
    }

    if (isExpired(data.expiresAt)) {
      const err = new Error('La date d\'expiration doit être dans le futur');
      err.status = 400; throw err;
    }

    // Valider les paliers de prix
    if (!data.pricingTiers || data.pricingTiers.length === 0) {
      const err = new Error('Au moins un palier de prix est requis');
      err.status = 400; throw err;
    }

    return prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          productId      : data.productId,
          supplierId     : supplier?.id ?? null,
          title          : data.title || `Groupe ${product.name}`,
          minParticipants: data.minParticipants,
          maxParticipants: data.maxParticipants,
          currentPrice   : product.baseGroupPrice,
          currentCount   : 0,
          depositPercent : data.depositPercent || 0.1,
          expiresAt      : new Date(data.expiresAt),
          status         : 'OPEN',
          pricingTiers   : {
            create: data.pricingTiers.map(t => ({
              participantCount: t.participantCount,
              discountPercent : t.discountPercent,
              priceAtTier     : Math.ceil(product.baseGroupPrice * (1 - t.discountPercent / 100)),
            })),
          },
        },
        include: { pricingTiers: true },
      });

      return group;
    });
  }

  /**
   * Modifier un groupe ouvert (fournisseur propriétaire ou admin)
   */
  async updateGroup(groupId, userId, data, isAdmin = false) {
    const group = await prisma.group.findUnique({
      where  : { id: groupId },
      include: { supplier: true },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404; throw err;
    }

    if (group.status !== 'OPEN') {
      const err = new Error('Impossible de modifier un groupe qui n\'est plus ouvert');
      err.status = 409; throw err;
    }

    if (!isAdmin && group.supplier?.userId !== userId) {
      const err = new Error('Vous n\'êtes pas autorisé à modifier ce groupe');
      err.status = 403; throw err;
    }

    // Valider la nouvelle date d'expiration
    if (data.expiresAt && isExpired(data.expiresAt)) {
      const err = new Error('La date d\'expiration doit être dans le futur');
      err.status = 400; throw err;
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data : {
        ...(data.expiresAt      && { expiresAt      : new Date(data.expiresAt) }),
        ...(data.maxParticipants && { maxParticipants: parseInt(data.maxParticipants) }),
      },
    });

    // Notifier les membres
    await notificationService.notifyGroupMembers(groupId, {
      type    : 'SYSTEM',
      title   : '📢 Groupe mis à jour',
      body    : 'Les paramètres de ce groupe ont été modifiés par le fournisseur.',
      channels: ['push'],
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // PARTICIPATION MEMBRES
  // ──────────────────────────────────────────────────────────

  /**
   * Étape 1 — Vérifier les conditions pour rejoindre un groupe.
   * Retourne le montant du dépôt à payer.
   * Le membre est ajouté SEULEMENT après confirmation du paiement.
   */
  async joinGroup(groupId, userId) {
    const [group, user] = await Promise.all([
      prisma.group.findUnique({
        where  : { id: groupId },
        include: { pricingTiers: true },
      }),
      prisma.user.findUnique({
        where : { id: userId },
        select: { trustScore: true },
      }),
    ]);

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404; throw err;
    }

    if (group.status !== 'OPEN') {
      const err = new Error('Ce groupe n\'est plus ouvert aux inscriptions');
      err.status = 409; err.code = 'GROUP_CLOSED'; throw err;
    }

    if (group.currentCount >= group.maxParticipants) {
      const err = new Error('Ce groupe est complet');
      err.status = 409; err.code = 'GROUP_FULL'; throw err;
    }

    if (isExpired(group.expiresAt)) {
      const err = new Error('Ce groupe a expiré');
      err.status = 409; err.code = 'GROUP_EXPIRED'; throw err;
    }

    if (user.trustScore < MIN_TRUST_SCORE) {
      const err = new Error('Votre score de confiance est insuffisant pour rejoindre un groupe');
      err.status = 403; throw err;
    }

    // Vérifier si déjà membre
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing?.status === 'ACTIVE') {
      const err = new Error('Vous êtes déjà membre de ce groupe');
      err.status = 409; err.code = 'ALREADY_MEMBER'; throw err;
    }

    // Vérifier le nombre max de groupes actifs
    const activeCount = await prisma.groupMember.count({
      where: {
        userId,
        status: 'ACTIVE',
        group : { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
      },
    });

    if (activeCount >= MAX_ACTIVE_GROUPS_PER_USER) {
      const err = new Error(`Maximum ${MAX_ACTIVE_GROUPS_PER_USER} groupes actifs simultanés autorisés`);
      err.status = 409; throw err;
    }

    const depositAmount = calculateDeposit(group.currentPrice, group.depositPercent);
    const nextTier      = getNextTier(group.pricingTiers, group.currentCount + 1);

    return {
      groupId,
      currentPrice   : group.currentPrice,
      depositAmount,
      depositPercent : group.depositPercent * 100,
      nextTier,
      spotsLeft      : group.maxParticipants - group.currentCount,
      message        : 'Procédez au paiement du dépôt pour confirmer votre participation',
    };
  }

  /**
   * Étape 2 — Confirmer l'ajout d'un membre après paiement du dépôt.
   * Appelé par le service de paiement après confirmation CinetPay.
   */
  async confirmJoinAfterDeposit(groupId, userId, depositAmount) {
    const group = await prisma.group.findUnique({
      where  : { id: groupId },
      include: { pricingTiers: true },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404; throw err;
    }

    return prisma.$transaction(async (tx) => {
      const newCount = group.currentCount + 1;
      const newPrice = calculateCurrentPrice(group.pricingTiers, newCount) ?? group.currentPrice;
      const thresholdJustReached = newCount >= group.minParticipants && group.status === 'OPEN';

      // Créer le membre
      const member = await tx.groupMember.create({
        data: {
          groupId,
          userId,
          depositPaid: depositAmount,
          status     : 'ACTIVE',
          isLeader   : newCount === 1,
        },
      });

      // Mettre à jour le groupe
      const updatedGroup = await tx.group.update({
        where: { id: groupId },
        data : {
          currentCount: newCount,
          currentPrice: newPrice,
          ...(thresholdJustReached && {
            status    : 'THRESHOLD_REACHED',
            reachedAt : new Date(),
          }),
        },
        include: { pricingTiers: true },
      });

      // Notifier nouveau membre
      await notificationService.notifyGroupMembers(groupId, {
        type    : 'NEW_MEMBER',
        title   : '👥 Nouveau membre rejoint !',
        body    : `Le groupe compte ${newCount} membres. Prix actuel : ${newPrice.toLocaleString()} FCFA`,
        channels: ['push'],
      });

      // Notif spéciale si seuil atteint
      if (thresholdJustReached) {
        await notificationService.notifyGroupMembers(groupId, {
          type    : 'GROUP_SUCCESS',
          title   : '🎉 Seuil minimum atteint !',
          body    : `Payez le solde pour finaliser. Prix final : ${newPrice.toLocaleString()} FCFA`,
          channels: ['sms', 'push'],
        });
      }

      // WebSocket temps réel
      emitSocket(`group:${groupId}`, 'group:updated', {
        groupId, newCount, newPrice,
        status: updatedGroup.status,
      });

      return { member, group: updatedGroup };
    });
  }

  /**
   * Quitter un groupe (uniquement si statut OPEN)
   */
  async leaveGroup(groupId, userId) {
    const member = await prisma.groupMember.findUnique({
      where  : { groupId_userId: { groupId, userId } },
      include: { group: true },
    });

    if (!member || member.status !== 'ACTIVE') {
      const err = new Error('Vous n\'êtes pas membre de ce groupe');
      err.status = 404; throw err;
    }

    if (member.group.status !== 'OPEN') {
      const err = new Error('Impossible de quitter un groupe après que le seuil minimum soit atteint');
      err.status = 409; err.code = 'THRESHOLD_REACHED'; throw err;
    }

    return prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId } },
        data : { status: 'CANCELLED', cancelledAt: new Date() },
      });

      const newCount = Math.max(0, member.group.currentCount - 1);
      await tx.group.update({
        where: { id: groupId },
        data : { currentCount: newCount },
      });

      // Marquer le dépôt comme remboursé
      await tx.payment.updateMany({
        where: { userId, groupId, type: 'DEPOSIT', status: 'ESCROWED' },
        data : { status: 'REFUNDED' },
      });

      return { refundAmount: member.depositPaid };
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRON JOB — Expiration des groupes
  // ──────────────────────────────────────────────────────────

  /**
   * Marque les groupes expirés comme FAILED et rembourse les dépôts.
   * Appelé par le CRON job toutes les heures.
   */
  async expireFailedGroups() {
    const expiredGroups = await prisma.group.findMany({
      where  : { status: 'OPEN', expiresAt: { lt: new Date() } },
      include: { members: { where: { status: 'ACTIVE' }, select: { userId: true } } },
    });

    let count = 0;

    for (const group of expiredGroups) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.group.update({
            where: { id: group.id },
            data : { status: 'FAILED' },
          });

          await tx.payment.updateMany({
            where: { groupId: group.id, type: 'DEPOSIT', status: 'ESCROWED' },
            data : { status: 'REFUNDED' },
          });

          await tx.groupMember.updateMany({
            where: { groupId: group.id, status: 'ACTIVE' },
            data : { status: 'CANCELLED', cancelledAt: new Date() },
          });
        });

        // Notifications et WebSocket
        await notificationService.notifyGroupMembers(group.id, {
          type    : 'GROUP_FAILED',
          title   : '❌ Groupe expiré',
          body    : 'Le groupe n\'a pas atteint son seuil. Votre dépôt sera remboursé dans 72h.',
          channels: ['sms', 'email'],
        });

        emitSocket(`group:${group.id}`, 'group:failed', { groupId: group.id });

        count++;
      } catch (err) {
        // Logger l'erreur mais continuer avec les autres groupes
        const logger = require('../../utils/logger');
        logger.error(`Erreur expiration groupe ${group.id}:`, err);
      }
    }

    return count;
  }
}

module.exports = new GroupsService();