// ============================================================
// NOTIFICATION SERVICE — Notifications in-app, SMS, Email
// Djula Market — Burkina Faso
// ============================================================

const prisma  = require('../../config/database');
const env     = require('../../config/env');
const logger  = require('../../utils/logger');

// ── Transporter email (créé une seule fois) ──────────────────
let _transporter = null;
const getTransporter = () => {
  if (!_transporter && env.SENDGRID_API_KEY) {
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransporter({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: env.SENDGRID_API_KEY },
    });
  }
  return _transporter;
};

// ── Émettre via WebSocket (non bloquant) ─────────────────────
const emitSocket = (room, event, data) => {
  try {
    const io = require('../../sockets/socket').getIO();
    io.to(room).emit(event, data);
  } catch {}
};

class NotificationService {

  // ──────────────────────────────────────────────────────────
  // NOTIFICATION PRINCIPALE
  // ──────────────────────────────────────────────────────────

  /**
   * Créer et envoyer une notification à un utilisateur
   */
  async notify(userId, { type, title, body, groupId = null, channels = [] }) {
    const user = await prisma.user.findUnique({
      where : { id: userId },
      select: { phone: true, email: true, notifSMS: true, notifEmail: true, notifPush: true },
    });
    if (!user) return null;

    const sentVia  = [];
    const sendAll  = channels.length === 0;

    // ── Email ──────────────────────────────────────────────
    if (user.notifEmail && user.email && (sendAll || channels.includes('email'))) {
      await this.sendEmail(user.email, title, body)
        .catch(e => logger.error('Email error:', e));
      sentVia.push('email');
    }

    // ── SMS ────────────────────────────────────────────────
    if (user.notifSMS && user.phone && (sendAll || channels.includes('sms'))) {
      await this.sendSMS(user.phone, `${title} : ${body}`)
        .catch(e => logger.error('SMS error:', e));
      sentVia.push('sms');
    }

    // ── Créer en base ──────────────────────────────────────
    const notification = await prisma.notification.create({
      data: { userId, groupId, type, title, body, sentVia },
    });

    // ── Push WebSocket ─────────────────────────────────────
    emitSocket(`user:${userId}`, 'notification', notification);

    return notification;
  }

  /**
   * Notifier tous les membres actifs d'un groupe
   */
  async notifyGroupMembers(groupId, notifData) {
    const members = await prisma.groupMember.findMany({
      where : { groupId, status: { in: ['ACTIVE', 'PAID'] } },
      select: { userId: true },
    });

    await Promise.allSettled(
      members.map(m => this.notify(m.userId, { ...notifData, groupId }))
    );
  }

  // ──────────────────────────────────────────────────────────
  // CANAUX D'ENVOI
  // ──────────────────────────────────────────────────────────

  /**
   * Envoi SMS via Twilio
   */
  async sendSMS(to, message) {
    if (!env.TWILIO_ACCOUNT_SID || env.IS_DEV) {
      logger.debug(`[SMS MOCK] To: ${to} | ${message}`);
      return;
    }
    const twilio = require('twilio')(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    return twilio.messages.create({
      body: message,
      from: env.TWILIO_PHONE_NUMBER,
      to,
    });
  }

  /**
   * Envoi Email via SendGrid / Nodemailer
   */
  async sendEmail(to, subject, text) {
    if (!env.SENDGRID_API_KEY || env.IS_DEV) {
      logger.debug(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return;
    }
    const transporter = getTransporter();
    return transporter.sendMail({
      from   : `"${env.SENDGRID_FROM_NAME}" <${env.SENDGRID_FROM_EMAIL}>`,
      to,
      subject,
      text,
    });
  }

  // ──────────────────────────────────────────────────────────
  // LECTURE
  // ──────────────────────────────────────────────────────────

  async getMyNotifications(userId, query) {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(50, parseInt(query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where  : { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  async markRead(notifId, userId) {
    const notif = await prisma.notification.findFirst({
      where: { id: notifId, userId },
    });
    if (!notif) {
      const err = new Error('Notification introuvable');
      err.status = 404; throw err;
    }
    return prisma.notification.update({
      where: { id: notifId },
      data : { isRead: true },
    });
  }

  async markAllRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data : { isRead: true },
    });
  }
}

module.exports = new NotificationService();