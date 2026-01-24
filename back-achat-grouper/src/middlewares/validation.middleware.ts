import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/api-error.util';

/**
 * Middleware générique de validation avec Zod
 * @param schema - Schéma Zod pour la validation
 */
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(new ApiError(400, 'Erreur de validation', error.errors));
      }
      next(error);
    }
  };
};
