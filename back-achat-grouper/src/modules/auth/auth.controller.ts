import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ApiError } from '../../utils/api-error.util';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Inscription d'un nouvel utilisateur
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Connexion utilisateur (email ou téléphone)
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      
      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-otp
   * Vérifier le code OTP (email ou SMS)
   */
  static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.verifyOtp(req.body);
      
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/resend-otp
   * Renvoyer le code OTP
   */
  static async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.resendOtp(req.body);
      
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/request-reset-password
   * Demander la réinitialisation du mot de passe
   */
  static async requestResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.requestResetPassword(req.body);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: { userId: result.userId },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   * Réinitialiser le mot de passe avec code OTP
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.resetPassword(req.body);
      
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   * Rafraîchir le token d'accès
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.refreshAccessToken(req.body);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Déconnexion utilisateur
   */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.logout(refreshToken);
      
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Obtenir les informations de l'utilisateur connecté
   */
  static async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const user = await AuthService.getCurrentUser(userId);
      
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}