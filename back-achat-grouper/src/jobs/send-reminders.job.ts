import { prisma } from '../config/database';
import { logger } from '../utils/logger.util';
import { sendNotification } from '../utils/notification.util';
import { addHours } from 'date-fns';

/**
 * Envoyer des rappels pour les groupes qui expirent bientôt
 */
export async function sendReminders() {
  try {
    const now = new Date();
    const in24Hours = addHours(now, 24);

    // Trouver les groupes qui expirent dans les prochaines 24h
    const groupsExpiringSoon = await prisma.group.findMany({
      where: {
        status: 'OPEN',
        endDate: {
          gte: now,
          lte: in24Hours,
        },
      },
      include: {
        members: true,
      },
    });

    logger.info(`Sending reminders for ${groupsExpiringSoon.length} groups expiring soon`);

    for (const group of groupsExpiringSoon) {
      // Calculer le nombre de places restantes
      const spotsLeft = group.maxParticipants - group.currentParticipants;

      for (const member of group.members) {
        await sendNotification({
          userId: member.userId,
          type: 'GROUP_REMINDER',
          title: '⏰ Le groupe expire bientôt !',
          message: `Le groupe "${group.name}" expire dans 24h. Il reste ${spotsLeft} places. Partagez avec vos amis !`,
          data: { groupId: group.id },
        });
      }
    }
  } catch (error) {
    logger.error('Error sending reminders:', error);
  }
}