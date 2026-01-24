import { prisma } from '../config/database';
import { sendEmail, emailTemplates } from './email.util';
import { sendSms } from './sms.util';
import { logger } from './logger.util';

interface NotificationOptions {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

/**
 * Envoyer une notification (email + SMS + enregistrer en BDD)
 */
export async function sendNotification(options: NotificationOptions): Promise<void> {
  try {
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: options.userId },
      select: { email: true, phone: true, firstName: true },
    });

    if (!user) {
      logger.warn(`User not found for notification: ${options.userId}`);
      return;
    }

    // Enregistrer la notification en BDD
    await prisma.notification.create({
      data: {
        userId: options.userId,
        type: 'EMAIL',
        title: options.title,
        message: options.message,
        data: options.data || {},
        sentAt: new Date(),
      },
    });

    // Envoyer par email
    try {
      await sendEmail({
        to: user.email,
        subject: options.title,
        html: `
          <h2>${options.title}</h2>
          <p>${options.message}</p>
        `,
      });
    } catch (error) {
      logger.error('Failed to send email notification:', error);
    }

    // Envoyer par SMS si numéro disponible
    if (user.phone) {
      try {
        await sendSms({
          to: user.phone,
          message: `${options.title}: ${options.message}`,
        });
      } catch (error) {
        logger.error('Failed to send SMS notification:', error);
      }
    }

    logger.info(`Notification sent to user ${options.userId}`);
  } catch (error) {
    logger.error('Error sending notification:', error);
  }
}