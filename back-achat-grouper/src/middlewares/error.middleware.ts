import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error.util';
import { logger } from '../utils/logger.util';
import { Prisma } from '@prisma/client';

/**
 * Middleware de gestion globale des erreurs
 */
export const errorMiddleware = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Logger l'erreur
  logger.error('Error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Erreur API personnalisée
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
    });
  }

  // Erreur Prisma (base de données)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Erreur de contrainte unique (ex: email déjà utilisé)
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Cette valeur existe déjà',
        errors: error.meta,
      });
    }

    // Erreur d'enregistrement non trouvé
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Ressource non trouvée',
      });
    }
  }

  // Erreur Prisma de validation
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation des données',
    });
  }

  // Erreur JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expiré',
    });
  }

  // Erreur par défaut
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : error.message,
  });
};
