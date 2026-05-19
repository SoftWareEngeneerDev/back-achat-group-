// ============================================================
// DISPUTES SERVICE — Litiges et réclamations
// Djula Market — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

class DisputesService {

  /**
   * Ouvrir un nouveau litige
   */
  async createDispute(userId, { subject, description, groupId, orderId }) {
    // Vérifier qu'il n'a pas déjà un litige ouvert sur cette commande
    if (orderId) {
      const existing = await prisma.dispute.findFirst({
        where: { userId, orderId, status: { in: ['OPEN', 'IN_REVIEW'] } },
      });
      if (existing) {
        const err = new Error('Vous avez déjà un litige ouvert sur cette commande');
        err.status = 409; throw err;
      }
    }

    return prisma.dispute.create({
      data: {
        userId,
        subject,
        description,
        groupId: groupId || null,
        orderId: orderId || null,
        status : 'OPEN',
      },
    });
  }

  /**
   * Détail d'un litige — accessible uniquement par son créateur
   */
  async getDisputeById(disputeId, userId) {
    const dispute = await prisma.dispute.findFirst({
      where  : { id: disputeId, userId },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!dispute) {
      const err = new Error('Litige introuvable'); err.status = 404; throw err;
    }
    return dispute;
  }

  /**
   * Mes litiges (membre)
   */
  async getMyDisputes(userId) {
    return prisma.dispute.findMany({
      where  : { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tous les litiges paginés (admin)
   */
  async getAllDisputes(query) {
    const { page, limit, skip } = getPagination(query);
    const where = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;

    const [data, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip, take: limit,
        include: { user: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispute.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Prendre en charge un litige → IN_REVIEW (admin)
   */
  async takeChargeDispute(disputeId, adminId) {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      const err = new Error('Litige introuvable'); err.status = 404; throw err;
    }
    if (dispute.status !== 'OPEN') {
      const err = new Error('Ce litige est déjà en cours de traitement');
      err.status = 409; throw err;
    }

    return prisma.dispute.update({
      where: { id: disputeId },
      data : { status: 'IN_REVIEW', assignedTo: adminId },
    });
  }

  /**
   * Résoudre un litige (admin)
   */
  async resolveDispute(disputeId, adminId, resolution) {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      const err = new Error('Litige introuvable'); err.status = 404; throw err;
    }
    if (dispute.status === 'RESOLVED') {
      const err = new Error('Ce litige est déjà résolu'); err.status = 409; throw err;
    }

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

    return updated;
  }
}

module.exports = new DisputesService();