import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import { ApiError } from '../utils/api-error.util';

// Extension de l'interface Request pour ajouter user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware pour vérifier le token JWT
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Token manquant');
    }

    const token = authHeader.substring(7); // Retirer "Bearer "

    // Vérifier le token
    const payload = verifyToken(token);

    if (!payload) {
      throw new ApiError(401, 'Token invalide ou expiré');
    }

    // Ajouter les infos de l'utilisateur à la requête
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
