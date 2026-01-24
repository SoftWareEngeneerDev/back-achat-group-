import { Request, Response, NextFunction } from 'express';
import { 
  registerSchema, 
  loginSchema, 
  verifyOtpSchema,
  resendOtpSchema,
  requestResetPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema 
} from './dto';
import { ApiError } from '../../utils/api-error.util';

export class AuthValidation {
  /**
   * Valider les données d'inscription
   */
  static validateRegister(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = registerSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider les données de connexion
   */
  static validateLogin(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = loginSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider les données de vérification OTP
   */
  static validateVerifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = verifyOtpSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider les données de renvoi OTP
   */
  static validateResendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = resendOtpSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider la demande de réinitialisation
   */
  static validateRequestReset(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = requestResetPasswordSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider la réinitialisation du mot de passe
   */
  static validateResetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = resetPasswordSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }

  /**
   * Valider le refresh token
   */
  static validateRefreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      req.body = refreshTokenSchema.parse(req.body);
      next();
    } catch (error: any) {
      next(new ApiError(400, 'Données invalides', error.errors));
    }
  }
}