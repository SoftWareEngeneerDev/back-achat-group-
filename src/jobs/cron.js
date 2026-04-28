// ============================================================
// CRON JOBS — Tâches planifiées
// Djula Market — Burkina Faso
// ============================================================

const cron   = require('node-cron');
const logger = require('../utils/logger');

// ── Helper : exécuter un job avec logs ───────────────────────
const runJob = async (name, fn) => {
  logger.info(`[CRON] ▶ ${name}...`);
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    logger.info(`[CRON] ✅ ${name} — ${ms}ms${result ? ` (${result})` : ''}`);
  } catch (err) {
    logger.error(`[CRON] ❌ ${name} — Erreur:`, err.message);
  }
};

const initCronJobs = () => {

  // ── Groupes expirés — toutes les heures ──────────────────
  cron.schedule('0 * * * *', () =>
    runJob('Expiration groupes', async () => {
      const groupsService = require('../modules/groups/groups.service');
      const count = await groupsService.expireFailedGroups();
      return count > 0 ? `${count} groupes échoués` : null;
    })
  );

  // ── Rappels paiement solde — toutes les 6h ───────────────
  // Notifie les membres qui n'ont pas payé le solde 24h avant expiration
  cron.schedule('0 */6 * * *', () =>
    runJob('Rappels paiement solde', async () => {
      const prisma = require('../config/database');
      const notifService = require('../modules/notifications/notification.service');

      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const groups = await prisma.group.findMany({
        where: {
          status   : 'THRESHOLD_REACHED',
          expiresAt: { lte: deadline, gte: new Date() },
        },
        include: {
          members : { where: { status: 'ACTIVE' }, select: { userId: true } },
          product : { select: { name: true } },
        },
      });

      for (const group of groups) {
        await notifService.notifyGroupMembers(group.id, {
          type    : 'PAYMENT_REMINDER',
          title   : '⏰ Rappel paiement',
          body    : `Le groupe "${group.product.name}" expire dans moins de 24h. Payez le solde pour confirmer votre commande.`,
          channels: ['sms', 'push'],
        });
      }

      return groups.length > 0 ? `${groups.length} groupes notifiés` : null;
    })
  );

  // ── Sessions expirées — chaque nuit à 2h ─────────────────
  cron.schedule('0 2 * * *', () =>
    runJob('Nettoyage sessions', async () => {
      const prisma = require('../config/database');
      const { count } = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return `${count} sessions supprimées`;
    })
  );

  // ── OTP expirés — chaque nuit à 3h ───────────────────────
  cron.schedule('0 3 * * *', () =>
    runJob('Nettoyage OTP', async () => {
      const prisma = require('../config/database');
      const { count } = await prisma.otpCode.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return `${count} codes OTP supprimés`;
    })
  );

  // ── Notifications non lues > 30 jours — chaque dimanche à 4h
  cron.schedule('0 4 * * 0', () =>
    runJob('Archivage notifications anciennes', async () => {
      const prisma = require('../config/database');
      const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count } = await prisma.notification.deleteMany({
        where: { createdAt: { lt: threshold }, isRead: true },
      });
      return `${count} notifications archivées`;
    })
  );

  logger.info('✅ CRON jobs initialisés (5 jobs)');
};

module.exports = { initCronJobs };