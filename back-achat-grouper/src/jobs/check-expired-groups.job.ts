import { prisma } from '../config/database';
import { logger } from '../utils/logger.util';
import { sendNotification } from '../utils/notification.util';

/**
 * Vérifier et traiter les groupes expirés
 */
export async function checkExpiredGroups() {
  try {
    const now = new Date();

    // Trouver tous les groupes expirés qui sont encore OPEN
    const expiredGroups = await prisma.group.findMany({
      where: {
        status: 'OPEN',
        endDate: {
          lt: now,
        },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    logger.info(`Found ${expiredGroups.length} expired groups`);

    for (const group of expiredGroups) {
      // Vérifier si le seuil minimum est atteint
      const thresholdReached = group.currentParticipants >= group.minParticipants;

      if (thresholdReached) {
        // Groupe réussi - passer en CLOSED
        await prisma.group.update({
          where: { id: group.id },
          data: {
            status: 'CLOSED',
            completedAt: now,
          },
        });

        // Notifier les membres
        for (const member of group.members) {
          await sendNotification({
            userId: member.userId,
            type: 'GROUP_SUCCESS',
            title: 'Groupe réussi !',
            message: `Le groupe "${group.name}" a atteint son objectif. Procédez au paiement final.`,
            data: { groupId: group.id },
          });
        }

        logger.info(`Group ${group.id} marked as CLOSED (success)`);
      } else {
        // Groupe échoué - passer en FAILED
        await prisma.group.update({
          where: { id: group.id },
          data: { status: 'FAILED' },
        });

        // Notifier les membres et déclencher les remboursements
        for (const member of group.members) {
          await sendNotification({
            userId: member.userId,
            type: 'GROUP_FAILED',
            title: 'Groupe non abouti',
            message: `Le groupe "${group.name}" n'a pas atteint le quota. Votre dépôt sera remboursé.`,
            data: { groupId: group.id },
          });

          // TODO: Déclencher le remboursement via le provider de paiement
        }

        logger.info(`Group ${group.id} marked as FAILED`);
      }
    }
  } catch (error) {
    logger.error('Error checking expired groups:', error);
  }
}