import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error.util';

/**
 * Middleware pour vérifier le rôle de l'utilisateur
 * @param allowedRoles - Liste des rôles autorisés
 */
export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Non authentifié');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ApiError(403, 'Accès interdit : rôle insuffisant');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};