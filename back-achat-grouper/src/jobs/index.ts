import cron from 'node-cron';
import { logger } from '../utils/logger.util';
import { checkExpiredGroups } from './check-expired-groups.job';
import { processRefunds } from './process-refunds.job';
import { sendReminders } from './send-reminders.job';

/**
 * Démarrer toutes les tâches planifiées
 */
export function startCronJobs() {
  logger.info('Starting cron jobs...');

  // Vérifier les groupes expirés toutes les 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running job: check-expired-groups');
    await checkExpiredGroups();
  });

  // Traiter les remboursements tous les jours à 2h du matin
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running job: process-refunds');
    await processRefunds();
  });

  // Envoyer les rappels tous les jours à 10h
  cron.schedule('0 10 * * *', async () => {
    logger.info('Running job: send-reminders');
    await sendReminders();
  });

  logger.info('✅ Cron jobs started');
}