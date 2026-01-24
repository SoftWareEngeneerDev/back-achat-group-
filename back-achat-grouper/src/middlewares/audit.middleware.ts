import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger.util';

/**
 * Middleware pour logger les actions admin
 * Utilisé uniquement sur les routes admin critiques
 */
export const auditMiddleware = (action: string, entity: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sauvegarder l'action dans les logs d'audit
      if (req.user && req.user.role === 'ADMIN') {
        await prisma.auditLog.create({
          data: {
            userId: req.user.userId,
            action,
            entity,
            entityId: req.params.id || '',
            oldData: req.body.oldData || null,
            newData: req.body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || '',
          },
        });

        logger.info(`Admin action: ${action} on ${entity} by ${req.user.userId}`);
      }

      next();
    } catch (error) {
      // Ne pas bloquer la requête si l'audit échoue
      logger.error('Audit middleware error:', error);
      next();
    }
  };
};