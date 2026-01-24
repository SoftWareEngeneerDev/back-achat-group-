import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/api-error.util';

/**
 * Créer un middleware de limitation de taux
 * @param maxRequests - Nombre maximum de requêtes
 * @param windowMinutes - Fenêtre de temps en minutes
 */
export const rateLimitMiddleware = (maxRequests: number = 100, windowMinutes: number = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: 'Trop de requêtes, veuillez réessayer plus tard',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new ApiError(429, 'Trop de requêtes, veuillez réessayer plus tard');
    },
  });
};

/**
 * Rate limiter global pour toutes les routes
 */
export const globalRateLimiter = rateLimitMiddleware(100, 15); 