const prisma = require('../../config/database');
const env = require('../../config/env');
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Créer et envoyer une notification à un utilisateur
   */
  async notify(userId, { type, title, body, groupId = null, channels = [] }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, email: true, notifSMS: true, notifEmail: true, notifPush: true },
    });
    if (!user) return;

    const sentVia = [];

    // Email
    if (user.notifEmail && user.email && (channels.includes('email') || channels.length === 0)) {
      await this.sendEmail(user.email, title, body).catch(e => logger.error('Email error:', e));
      sentVia.push('email');
    }

    // SMS
    if (user.notifSMS && user.phone && (channels.includes('sms') || channels.length === 0)) {
      await this.sendSMS(user.phone, `${title}: ${body}`).catch(e => logger.error('SMS error:', e));
      sentVia.push('sms');
    }

    const notification = await prisma.notification.create({
      data: { userId, groupId, type, title, body, sentVia },
    });

    // Push via Socket.io
    const io = require('../../sockets/socket').getIO();
    io.to(`user:${userId}`).emit('notification', notification);

    return notification;
  }

  /**
   * Notifier tous les membres actifs d'un groupe
   */
  async notifyGroupMembers(groupId, notifData) {
    const members = await prisma.groupMember.findMany({
      where: { groupId, status: { in: ['ACTIVE', 'PAID'] } },
      select: { userId: true },
    });

    await Promise.allSettled(
      members.map(m => this.notify(m.userId, { ...notifData, groupId }))
    );
  }

  /**
   * Envoi SMS via Twilio
   */
  async sendSMS(to, message) {
    if (!env.TWILIO_ACCOUNT_SID || env.IS_DEV) {
      logger.debug(`[SMS MOCK] To: ${to} | Message: ${message}`);
      return;
    }
    const twilio = require('twilio')(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    return twilio.messages.create({ body: message, from: env.TWILIO_PHONE_NUMBER, to });
  }

  /**
   * Envoi Email via Nodemailer / SendGrid
   */
  async sendEmail(to, subject, text) {
    if (!env.SENDGRID_API_KEY || env.IS_DEV) {
      logger.debug(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return;
    }
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: env.SENDGRID_API_KEY },
    });
    return transporter.sendMail({
      from: `"${env.SENDGRID_FROM_NAME}" <${env.SENDGRID_FROM_EMAIL}>`,
      to, subject, text,
    });
  }

  async getMyNotifications(userId, query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { data, total, page, limit };
  }

  async markRead(notifId, userId) {
    return prisma.notification.updateMany({
      where: { id: notifId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}

module.exports = new NotificationService();
