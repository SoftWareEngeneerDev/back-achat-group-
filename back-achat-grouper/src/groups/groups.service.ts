import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error.util';
import { CreateGroupDto, UpdateGroupDto, JoinGroupDto } from './dto';
import { calculateGroupPrice, calculateDepositAmount, calculateFinalPayment } from './logic/price-calculator.logic';
import { isThresholdReached, isGroupFull, getCompletionPercentage } from './logic/threshold-checker.logic';
import { isGroupExpired } from './logic/expiration-checker.logic';
import { config } from '../../config/env';
import { sendNotification } from '../../utils/notification.util';

export class GroupsService {
  /**
   * Créer un nouveau groupe d'achat
   */
  static async createGroup(data: CreateGroupDto, createdBy: string) {
    // Vérifier que le produit existe
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new ApiError(404, 'Produit non trouvé');
    }

    if (product.status !== 'APPROVED') {
      throw new ApiError(400, 'Le produit doit être approuvé pour créer un groupe');
    }

    // Vérifier que maxParticipants >= minParticipants
    if (data.maxParticipants < data.minParticipants) {
      throw new ApiError(400, 'Le nombre max de participants doit être >= au nombre min');
    }

    // Vérifier la date de fin
    const endDate = new Date(data.endDate);
    if (endDate <= new Date()) {
      throw new ApiError(400, 'La date de fin doit être dans le futur');
    }

    // Calculer le prix initial (0 participants)
    const currentPrice = calculateGroupPrice(product.priceGroupBase, 0, data.discountCurve);

    // Créer le groupe
    const group = await prisma.group.create({
      data: {
        productId: data.productId,
        name: data.name,
        minParticipants: data.minParticipants,
        maxParticipants: data.maxParticipants,
        endDate,
        currentPrice,
        discountCurve: data.discountCurve,
        createdBy,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            priceSolo: true,
            priceGroupBase: true,
            images: true,
          },
        },
      },
    });

    return group;
  }

  /**
   * Obtenir tous les groupes (avec filtres)
   */
  static async getAllGroups(filters: {
    status?: string;
    productId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.productId) {
      where.productId = filters.productId;
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              priceSolo: true,
              priceGroupBase: true,
              images: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      }),
      prisma.group.count({ where }),
    ]);

    // Ajouter les métadonnées
    const groupsWithMetadata = groups.map(group => ({
      ...group,
      completionPercentage: getCompletionPercentage(group.currentParticipants, group.maxParticipants),
      isExpired: isGroupExpired(group.endDate),
      isFull: isGroupFull(group.currentParticipants, group.maxParticipants),
      thresholdReached: isThresholdReached(group.currentParticipants, group.minParticipants),
    }));

    return {
      groups: groupsWithMetadata,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtenir un groupe par ID
   */
  static async getGroupById(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        product: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new ApiError(404, 'Groupe non trouvé');
    }

    return {
      ...group,
      completionPercentage: getCompletionPercentage(group.currentParticipants, group.maxParticipants),
      isExpired: isGroupExpired(group.endDate),
      isFull: isGroupFull(group.currentParticipants, group.maxParticipants),
      thresholdReached: isThresholdReached(group.currentParticipants, group.minParticipants),
    };
  }

  /**
   * Rejoindre un groupe (payer le dépôt)
   */
  static async joinGroup(data: JoinGroupDto, userId: string) {
    // Vérifier que le groupe existe
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
      include: { product: true },
    });

    if (!group) {
      throw new ApiError(404, 'Groupe non trouvé');
    }

    // Vérifier que le groupe est ouvert
    if (group.status !== 'OPEN') {
      throw new ApiError(400, 'Ce groupe n\'est plus ouvert');
    }

    // Vérifier que le groupe n'a pas expiré
    if (isGroupExpired(group.endDate)) {
      throw new ApiError(400, 'Ce groupe a expiré');
    }

    // Vérifier que le groupe n'est pas complet
    if (isGroupFull(group.currentParticipants, group.maxParticipants)) {
      throw new ApiError(400, 'Ce groupe est complet');
    }

    // Vérifier que l'utilisateur n'est pas déjà membre
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: data.groupId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new ApiError(400, 'Vous êtes déjà membre de ce groupe');
    }

    // Calculer le montant du dépôt
    const depositAmount = calculateDepositAmount(group.currentPrice, config.depositPercentage);

    // TODO: Intégrer le paiement avec le provider (Orange Money, etc.)
    // Pour l'instant, on simule un paiement réussi

    // Ajouter le membre au groupe
    const member = await prisma.groupMember.create({
      data: {
        groupId: data.groupId,
        userId,
        depositPaid: depositAmount,
        depositStatus: 'COMPLETED', // Simulé pour l'instant
      },
    });

    // Incrémenter le nombre de participants
    const newParticipantsCount = group.currentParticipants + 1;

    // Recalculer le prix avec le nouveau nombre de participants
    const newPrice = calculateGroupPrice(
      group.product.priceGroupBase,
      newParticipantsCount,
      group.discountCurve as any
    );

    // Mettre à jour le groupe
    const updatedGroup = await prisma.group.update({
      where: { id: data.groupId },
      data: {
        currentParticipants: newParticipantsCount,
        currentPrice: newPrice,
        // Si seuil atteint, changer le statut
        status: isThresholdReached(newParticipantsCount, group.minParticipants) ? 'CLOSED' : 'OPEN',
        completedAt: isThresholdReached(newParticipantsCount, group.minParticipants) ? new Date() : null,
      },
    });

    // Notifier tous les membres du groupe
    await this.notifyGroupMembers(data.groupId, {
      type: 'GROUP_UPDATE',
      message: `Nouveau membre ! ${newParticipantsCount}/${group.maxParticipants} participants. Nouveau prix: ${newPrice} FCFA`,
    });

    // Si seuil atteint, déclencher la commande
    if (isThresholdReached(newParticipantsCount, group.minParticipants)) {
      await this.processGroupSuccess(data.groupId);
    }

    return {
      member,
      group: updatedGroup,
      depositPaid: depositAmount,
      message: 'Vous avez rejoint le groupe avec succès',
    };
  }

  /**
   * Annuler la participation à un groupe (avant que le seuil soit atteint)
   */
  static async leaveGroup(groupId: string, userId: string) {
    // Vérifier que le membre existe
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ApiError(404, 'Vous n\'êtes pas membre de ce groupe');
    }

    // Vérifier le statut du groupe
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new ApiError(404, 'Groupe non trouvé');
    }

    // Ne peut pas quitter si le groupe est déjà fermé
    if (group.status !== 'OPEN') {
      throw new ApiError(400, 'Impossible de quitter un groupe fermé ou terminé');
    }

    // Rembourser le dépôt (à implémenter avec le provider de paiement)
    // TODO: Appeler l'API de remboursement

    // Retirer le membre
    await prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Décrémenter le nombre de participants
    const newParticipantsCount = group.currentParticipants - 1;

    // Recalculer le prix
    const newPrice = calculateGroupPrice(
      group.currentPrice,
      newParticipantsCount,
      group.discountCurve as any
    );

    // Mettre à jour le groupe
    await prisma.group.update({
      where: { id: groupId },
      data: {
        currentParticipants: newParticipantsCount,
        currentPrice: newPrice,
      },
    });

    return {
      message: 'Vous avez quitté le groupe. Votre dépôt sera remboursé sous 72h.',
    };
  }

  /**
   * Traiter un groupe réussi (seuil atteint)
   */
  private static async processGroupSuccess(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: true },
        },
        product: true,
      },
    });

    if (!group) return;

    // Notifier tous les membres que le groupe est réussi
    for (const member of group.members) {
      // Calculer le solde final à payer
      const finalPayment = calculateFinalPayment(group.currentPrice, member.depositPaid);

      await sendNotification({
        userId: member.userId,
        type: 'GROUP_SUCCESS',
        title: 'Groupe réussi !',
        message: `Le groupe "${group.name}" a atteint son objectif ! Solde à payer: ${finalPayment} FCFA`,
        data: {
          groupId: group.id,
          finalPayment,
        },
      });
    }
  }

  /**
   * Notifier tous les membres d'un groupe
   */
  private static async notifyGroupMembers(groupId: string, notification: {
    type: string;
    message: string;
  }) {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    for (const member of members) {
      await sendNotification({
        userId: member.userId,
        type: notification.type,
        title: 'Mise à jour du groupe',
        message: notification.message,
        data: { groupId },
      });
    }
  }

  /**
   * Mettre à jour un groupe (pour admin/supplier)
   */
  static async updateGroup(groupId: string, data: UpdateGroupDto, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new ApiError(404, 'Groupe non trouvé');
    }

    // Vérifier les permissions (créateur ou admin)
    // TODO: Ajouter la vérification du rôle

    // Ne peut pas modifier un groupe fermé ou terminé
    if (group.status !== 'OPEN') {
      throw new ApiError(400, 'Impossible de modifier un groupe fermé ou terminé');
    }

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...data,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    return updatedGroup;
  }

  /**
   * Obtenir les groupes d'un utilisateur
   */
  static async getUserGroups(userId: string, status?: string) {
    const where: any = { userId };

    if (status === 'active') {
      where.leftAt = null;
    }

    const memberships = await prisma.groupMember.findMany({
      where,
      include: {
        group: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(m => ({
      ...m.group,
      memberSince: m.joinedAt,
      depositPaid: m.depositPaid,
      depositStatus: m.depositStatus,
      finalPaymentStatus: m.finalPaymentStatus,
    }));
  }
}