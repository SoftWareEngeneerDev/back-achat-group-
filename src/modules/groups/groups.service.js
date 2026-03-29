// ============================================================
// GROUPS SERVICE — Logique métier des groupes d'achat
// Plateforme Achats Groupés — Burkina Faso
// C'est le CŒUR du projet : tarification dynamique, escrow, WebSockets
// ============================================================

const prisma = require('../../config/database');
const { getPagination, calculateCurrentPrice, calculateDeposit } = require('../../utils/helpers');
const { PLATFORM_COMMISSION_RATE, MAX_ACTIVE_GROUPS_PER_USER, MIN_TRUST_SCORE } = require('../../config/constants');
const notificationService = require('../notifications/notification.service');

class GroupsService {

  // ──────────────────────────────────────────────────────────
  // ROUTES PUBLIQUES
  // ──────────────────────────────────────────────────────────

  /**
   * UC3 — Liste paginée des groupes actifs avec filtres.
   */
  async listGroups(query) {
    const { page, limit, skip } = getPagination(query);

    const where = {};
    // Par défaut on affiche les groupes ouverts
    where.status = query.status || 'OPEN';
    if (query.productId) where.productId = query.productId;

    // Filtre par pourcentage de complétion minimum
    if (query.minCompletion) {
      where.currentCount = {
        gte: prisma.group.fields.minParticipants * (parseFloat(query.minCompletion) / 100),
      };
    }

    const [data, total] = await Promise.all([
      prisma.group.findMany({
        where, skip, take: limit,
        include: {
          product: {
            select: { id: true, name: true, imagesUrls: true, soloPrice: true },
          },
          pricingTiers: { orderBy: { participantCount: 'asc' } },
          _count: { select: { members: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * UC4 — Détail complet d'un groupe (membres anonymisés, paliers).
   */
  async getGroup(id) {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
            supplier: { select: { companyName: true } },
          },
        },
        pricingTiers: { orderBy: { participantCount: 'asc' } },
        // SÉCURITÉ : membres anonymisés (pas de nom ni téléphone)
        members: {
          where: { status: 'ACTIVE' },
          select: { id: true, isLeader: true, joinedAt: true },
        },
      },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404;
      throw err;
    }

    return group;
  }

  /**
   * Progression en temps réel du groupe.
   */
  async getGroupProgress(groupId) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        currentCount: true,
        minParticipants: true,
        maxParticipants: true,
        currentPrice: true,
        status: true,
        expiresAt: true,
        pricingTiers: { orderBy: { participantCount: 'asc' } },
      },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404;
      throw err;
    }

    const completionPercent = Math.min(
      100,
      Math.round((group.currentCount / group.minParticipants) * 100)
    );

    return {
      ...group,
      completionPercent,
      spotsLeft: group.maxParticipants - group.currentCount,
      thresholdReached: group.currentCount >= group.minParticipants,
      timeLeftMs: new Date(group.expiresAt) - new Date(),
    };
  }

  // ──────────────────────────────────────────────────────────
  // CRÉATION ET MODIFICATION DE GROUPES
  // ──────────────────────────────────────────────────────────

  /**
   * UC22 (Fournisseur) / UC29 (Admin) — Créer un groupe d'achat.
   * Crée le groupe + les paliers de prix en une transaction.
   */
  async createGroup(userId, data, isAdmin = false) {
    // ── Vérifier le fournisseur si pas admin ───────────────
    let supplier = null;
    if (!isAdmin) {
      supplier = await prisma.supplier.findFirst({
        where: { userId, status: 'APPROVED' },
      });
      if (!supplier) {
        const err = new Error('Votre compte fournisseur n\'est pas encore validé');
        err.status = 403;
        throw err;
      }
    }

    // ── Vérifier le produit ────────────────────────────────
    const product = await prisma.product.findFirst({
      where: { id: data.productId, status: 'APPROVED' },
    });
    if (!product) {
      const err = new Error('Produit introuvable ou non approuvé');
      err.status = 404;
      throw err;
    }

    // ── Vérifier stock suffisant ───────────────────────────
    if (product.stock < data.minParticipants) {
      const err = new Error('Stock insuffisant pour le seuil minimum de participants');
      err.status = 409;
      throw err;
    }

    // ── Vérifier cohérence des paramètres ─────────────────
    if (data.minParticipants >= data.maxParticipants) {
      const err = new Error('Le seuil minimum doit être inférieur au maximum');
      err.status = 400;
      throw err;
    }

    if (new Date(data.expiresAt) <= new Date()) {
      const err = new Error('La date d\'expiration doit être dans le futur');
      err.status = 400;
      throw err;
    }

    // ── Créer le groupe + paliers en transaction ───────────
    return prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          productId: data.productId,
          supplierId: supplier?.id || null,
          title: data.title || `Groupe ${product.name}`,
          minParticipants: data.minParticipants,
          maxParticipants: data.maxParticipants,
          currentPrice: product.baseGroupPrice,
          currentCount: 0,
          depositPercent: data.depositPercent || 0.1,
          expiresAt: new Date(data.expiresAt),
          status: 'OPEN',
          pricingTiers: {
            create: data.pricingTiers.map(t => ({
              participantCount: t.participantCount,
              discountPercent: t.discountPercent,
              // Prix calculé automatiquement selon le pourcentage de réduction
              priceAtTier: product.baseGroupPrice * (1 - t.discountPercent / 100),
            })),
          },
        },
        include: { pricingTiers: true },
      });

      return group;
    });
  }

  /**
   * UC23 — Modifier un groupe ouvert (délai, max participants).
   * Seul le fournisseur propriétaire ou un admin peut modifier.
   */
  async updateGroup(groupId, userId, data, isAdmin = false) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { supplier: true },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404;
      throw err;
    }

    // ── Seuls les groupes OPEN peuvent être modifiés ───────
    if (group.status !== 'OPEN') {
      const err = new Error('Impossible de modifier un groupe qui n\'est plus ouvert');
      err.status = 409;
      throw err;
    }

    // ── Vérification ownership ─────────────────────────────
    if (!isAdmin && group.supplier?.userId !== userId) {
      const err = new Error('Vous n\'êtes pas autorisé à modifier ce groupe');
      err.status = 403;
      throw err;
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
        ...(data.maxParticipants && { maxParticipants: parseInt(data.maxParticipants) }),
      },
    });

    // ── Notifier les membres des changements ───────────────
    await notificationService.notifyGroupMembers(groupId, {
      type: 'SYSTEM',
      title: '📢 Groupe mis à jour',
      body: 'Les paramètres de ce groupe ont été modifiés par le fournisseur.',
      channels: ['push'],
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // PARTICIPATION MEMBRES
  // ──────────────────────────────────────────────────────────

  /**
   * UC8 — Étape 1 : Vérifier les conditions pour rejoindre un groupe.
   * Retourne le montant du dépôt à payer.
   * Le membre est ajouté SEULEMENT après confirmation du paiement.
   */
  async joinGroup(groupId, userId) {
    const [group, user] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        include: { pricingTiers: true },
      }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    // ── Validations ────────────────────────────────────────
    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404;
      throw err;
    }

    if (group.status !== 'OPEN') {
      const err = new Error('Ce groupe n\'est plus ouvert aux inscriptions');
      err.status = 409;
      err.code = 'GROUP_CLOSED';
      throw err;
    }

    if (group.currentCount >= group.maxParticipants) {
      const err = new Error('Ce groupe est complet');
      err.status = 409;
      err.code = 'GROUP_FULL';
      throw err;
    }

    // ── Vérifier le trust score ────────────────────────────
    if (user.trustScore < MIN_TRUST_SCORE) {
      const err = new Error('Votre score de confiance est insuffisant pour rejoindre un groupe');
      err.status = 403;
      throw err;
    }

    // ── Vérifier si déjà membre ────────────────────────────
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (existing && existing.status === 'ACTIVE') {
      const err = new Error('Vous êtes déjà membre de ce groupe');
      err.status = 409;
      err.code = 'ALREADY_MEMBER';
      throw err;
    }

    // ── Vérifier le nombre max de groupes actifs ───────────
    const activeGroupsCount = await prisma.groupMember.count({
      where: {
        userId,
        status: 'ACTIVE',
        group: { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
      },
    });

    if (activeGroupsCount >= MAX_ACTIVE_GROUPS_PER_USER) {
      const err = new Error(`Maximum ${MAX_ACTIVE_GROUPS_PER_USER} groupes actifs simultanés autorisés`);
      err.status = 409;
      throw err;
    }

    // ── Calculer le dépôt à payer ──────────────────────────
    const depositAmount = calculateDeposit(group.currentPrice, group.depositPercent);

    return {
      groupId,
      currentPrice: group.currentPrice,
      depositAmount,
      depositPercent: group.depositPercent * 100,
      message: 'Procédez au paiement du dépôt pour confirmer votre participation',
    };
  }

  /**
   * UC8 — Étape 2 : Confirmer l'ajout d'un membre après paiement du dépôt.
   * Appelé par le service de paiement après confirmation CinetPay.
   * Recalcule le prix + notifie tous les membres + émet via WebSocket.
   */
  async confirmJoinAfterDeposit(groupId, userId, depositAmount) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { pricingTiers: true },
    });

    if (!group) {
      const err = new Error('Groupe introuvable');
      err.status = 404;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const newCount = group.currentCount + 1;

      // ── Recalculer le prix selon les paliers ───────────────
      const newPrice = calculateCurrentPrice(group.pricingTiers, newCount) || group.currentPrice;

      // ── Créer le membre ────────────────────────────────────
      const member = await tx.groupMember.create({
        data: {
          groupId,
          userId,
          depositPaid: depositAmount,
          status: 'ACTIVE',
          isLeader: newCount === 1, // Le premier membre est leader
        },
      });

      // ── Mettre à jour le groupe ────────────────────────────
      const updatedGroup = await tx.group.update({
        where: { id: groupId },
        data: {
          currentCount: newCount,
          currentPrice: newPrice,
          // Passer en THRESHOLD_REACHED si seuil atteint
          ...(newCount >= group.minParticipants && group.status === 'OPEN' && {
            status: 'THRESHOLD_REACHED',
            reachedAt: new Date(),
          }),
        },
        include: { pricingTiers: true },
      });

      // ── Notifier tous les membres (prix mis à jour) ────────
      await notificationService.notifyGroupMembers(groupId, {
        type: 'NEW_MEMBER',
        title: '👥 Nouveau membre rejoint !',
        body: `Le groupe compte ${newCount} membres. Prix actuel : ${newPrice.toLocaleString()} FCFA`,
        channels: ['push'],
      });

      // ── Notif spéciale si seuil atteint ───────────────────
      if (updatedGroup.status === 'THRESHOLD_REACHED') {
        await notificationService.notifyGroupMembers(groupId, {
          type: 'GROUP_SUCCESS',
          title: '🎉 Seuil minimum atteint !',
          body: `Le groupe a atteint son seuil ! Payez le solde pour finaliser. Prix final : ${newPrice.toLocaleString()} FCFA`,
          channels: ['sms', 'push'],
        });
      }

      // ── Émettre via WebSocket (temps réel) ────────────────
      try {
        const io = require('../../sockets/socket').getIO();
        io.to(`group:${groupId}`).emit('group:updated', {
          groupId,
          newCount,
          newPrice,
          status: updatedGroup.status,
        });
      } catch {
        // Socket.io non critique — on continue même si ça échoue
      }

      return { member, group: updatedGroup };
    });
  }

  /**
   * UC9 — Quitter un groupe (uniquement si statut OPEN).
   * CORRECTION : Payment lié à userId + groupId (pas groupMemberId).
   */
  async leaveGroup(groupId, userId) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });

    if (!member) {
      const err = new Error('Vous n\'êtes pas membre de ce groupe');
      err.status = 404;
      throw err;
    }

    // ── Impossible de quitter après le seuil ──────────────
    if (member.group.status !== 'OPEN') {
      const err = new Error('Impossible de quitter un groupe après que le seuil minimum soit atteint');
      err.status = 409;
      err.code = 'THRESHOLD_REACHED';
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      // ── Annuler la participation ───────────────────────────
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId } },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      // ── Décrémenter le compteur ────────────────────────────
      const newCount = Math.max(0, member.group.currentCount - 1);
      await tx.group.update({
        where: { id: groupId },
        data: { currentCount: newCount },
      });

      // ── CORRECTION : Payment lié à userId + groupId ───────
      await tx.payment.updateMany({
        where: {
          userId,
          groupId,
          type: 'DEPOSIT',
          status: 'ESCROWED',
        },
        data: { status: 'REFUNDED' },
      });

      return { refundAmount: member.depositPaid };
    });
  }

  // ──────────────────────────────────────────────────────────
  // CRON JOB — Expiration des groupes
  // ──────────────────────────────────────────────────────────

  /**
   * Marque les groupes expirés comme FAILED et rembourse les dépôts.
   * CORRECTION : Payment filtré par userId + groupId (pas groupMemberId).
   * Appelé par le CRON job toutes les heures.
   */
  async expireFailedGroups() {
    // ── Trouver les groupes expirés ────────────────────────
    const expiredGroups = await prisma.group.findMany({
      where: {
        status: 'OPEN',
        expiresAt: { lt: new Date() },
      },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true },
        },
      },
    });

    for (const group of expiredGroups) {
      await prisma.$transaction(async (tx) => {
        // ── Marquer le groupe comme échoué ─────────────────
        await tx.group.update({
          where: { id: group.id },
          data: { status: 'FAILED' },
        });

        // ── Rembourser tous les dépôts en escrow ──────────
        // CORRECTION : filtrer par groupId directement
        await tx.payment.updateMany({
          where: {
            groupId: group.id,
            type: 'DEPOSIT',
            status: 'ESCROWED',
          },
          data: { status: 'REFUNDED' },
        });

        // ── Annuler les membres actifs ─────────────────────
        await tx.groupMember.updateMany({
          where: { groupId: group.id, status: 'ACTIVE' },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      });

      // ── Notifier les membres ───────────────────────────────
      await notificationService.notifyGroupMembers(group.id, {
        type: 'GROUP_FAILED',
        title: '❌ Groupe expiré',
        body: 'Le groupe n\'a pas atteint son seuil minimum. Votre dépôt sera remboursé dans 72h.',
        channels: ['sms', 'email'],
      });

      // ── Émettre via WebSocket ──────────────────────────────
      try {
        const io = require('../../sockets/socket').getIO();
        io.to(`group:${group.id}`).emit('group:failed', { groupId: group.id });
      } catch {
        // Non critique
      }
    }

    return expiredGroups.length;
  }
}

module.exports = new GroupsService();