import { Request, Response, NextFunction } from 'express';
import { createGroupSchema, updateGroupSchema, joinGroupSchema } from './dto';
import { ApiError } from '../../utils/api-error.util';

export class GroupsValidation {
  /**
   * Valider la création de groupe
   */
  static validateCreateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = createGroupSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider la mise à jour de groupe
   */
  static validateUpdateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = updateGroupSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider la participation à un groupe
   */
  static validateJoinGroup(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = joinGroupSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }
}