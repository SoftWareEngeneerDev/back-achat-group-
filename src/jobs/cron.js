const cron = require('node-cron');
const groupsService = require('../modules/groups/groups.service');
const logger = require('../utils/logger');

const initCronJobs = () => {
  // Vérifier les groupes expirés toutes les heures
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Vérification des groupes expirés...');
    try {
      const count = await groupsService.expireFailedGroups();
      if (count > 0) logger.info(`[CRON] ${count} groupes marqués comme échoués`);
    } catch (err) {
      logger.error('[CRON] Erreur expiration groupes:', err);
    }
  });

  // Nettoyage des sessions expirées chaque nuit à 2h
  cron.schedule('0 2 * * *', async () => {
    logger.info('[CRON] Nettoyage sessions expirées...');
    try {
      const prisma = require('../config/database');
      const { count } = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      logger.info(`[CRON] ${count} sessions supprimées`);
    } catch (err) {
      logger.error('[CRON] Erreur nettoyage sessions:', err);
    }
  });

  // Nettoyage OTP expirés chaque nuit à 3h
  cron.schedule('0 3 * * *', async () => {
    try {
      const prisma = require('../config/database');
      const { count } = await prisma.otpCode.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      logger.info(`[CRON] ${count} codes OTP supprimés`);
    } catch (err) {
      logger.error('[CRON] Erreur nettoyage OTP:', err);
    }
  });

  logger.info('CRON jobs initialisés');
};

module.exports = { initCronJobs };
