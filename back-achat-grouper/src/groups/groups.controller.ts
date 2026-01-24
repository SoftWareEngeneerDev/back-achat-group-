import { Request, Response, NextFunction } from 'express';
import { GroupsService } from './groups.service';

export class GroupsController {
  /**
   * POST /api/v1/groups
   * Créer un nouveau groupe
   */
  static async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const group = await GroupsService.createGroup(req.body, userId);

      res.status(201).json({
        success: true,
        message: 'Groupe créé avec succès',
        data: group,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/groups
   * Obtenir tous les groupes avec filtres
   */
  static async getAllGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: req.query.status as string,
        productId: req.query.productId as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await GroupsService.getAllGroups(filters);

      res.status(200).json({
        success: true,
        data: result.groups,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/groups/:id
   * Obtenir un groupe par ID
   */
  static async getGroupById(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await GroupsService.getGroupById(req.params.id);

      res.status(200).json({
        success: true,
        data: group,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/groups/:id/join
   * Rejoindre un groupe
   */
  static async joinGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await GroupsService.joinGroup(
        { ...req.body, groupId: req.params.id },
        userId
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          member: result.member,
          group: result.group,
          depositPaid: result.depositPaid,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/groups/:id/leave
   * Quitter un groupe
   */
  static async leaveGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const result = await GroupsService.leaveGroup(req.params.id, userId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/groups/:id
   * Mettre à jour un groupe
   */
  static async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const group = await GroupsService.updateGroup(req.params.id, req.body, userId);

      res.status(200).json({
        success: true,
        message: 'Groupe mis à jour avec succès',
        data: group,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/groups/my/groups
   * Obtenir les groupes de l'utilisateur connecté
   */
  static async getMyGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const status = req.query.status as string;
      const groups = await GroupsService.getUserGroups(userId, status);

      res.status(200).json({
        success: true,
        data: groups,
      });
    } catch (error) {
      next(error);
    }
  }
}