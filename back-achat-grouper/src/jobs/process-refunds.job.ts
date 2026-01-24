import { prisma } from '../config/database';
import { logger } from '../utils/logger.util';

/**
 * Traiter les remboursements en attente
 */
export async function processRefunds() {
  try {
    // Trouver les groupes échoués avec des remboursements en attente
    const failedGroups = await prisma.group.findMany({
      where: {
        status: 'FAILED',
        members: {
          some: {
            depositStatus: 'COMPLETED',
            finalPaymentStatus: 'PENDING',
          },
        },
      },
      include: {
        members: true,
      },
    });

    logger.info(`Processing refunds for ${failedGroups.length} failed groups`);

    for (const group of failedGroups) {
      for (const member of group.members) {
        if (member.depositStatus === 'COMPLETED' && member.depositPaid > 0) {
          // TODO: Appeler l'API du provider de paiement pour rembourser

          // Mettre à jour le statut
          await prisma.groupMember.update({
            where: {
              groupId_userId: {
                groupId: group.id,
                userId: member.userId,
              },
            },
            data: {
              depositStatus: 'REFUNDED',
            },
          });

          logger.info(`Refunded ${member.depositPaid} FCFA to user ${member.userId}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error processing refunds:', error);
  }
}