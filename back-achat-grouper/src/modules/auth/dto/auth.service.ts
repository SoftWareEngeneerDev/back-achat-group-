import { prisma } from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/bcrypt.util';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.util';
import { generateOtp } from '../../utils/otp.util';
import { sendEmail } from '../../utils/email.util';
import { sendSms } from '../../utils/sms.util';
import { RegisterDto, LoginDto, VerifyOtpDto, ResendOtpDto, ResetPasswordDto, RequestResetPasswordDto, RefreshTokenDto } from './dto';
import { ApiError } from '../../utils/api-error.util';
import { addMinutes } from 'date-fns';
import { OTP_VALIDITY_MINUTES } from '../../config/constants';

export class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  static async register(data: RegisterDto) {
    // Vérifier si l'email existe déjà
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUserByEmail) {
      throw new ApiError(400, 'Cet email est déjà utilisé');
    }

    // Vérifier si le téléphone existe déjà
    const existingUserByPhone = await prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existingUserByPhone) {
      throw new ApiError(400, 'Ce numéro de téléphone est déjà utilisé');
    }

    // Hasher le mot de passe
    const hashedPassword = await hashPassword(data.password);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'MEMBER',
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    // Générer et envoyer OTP email
    await this.sendOtp(user.id, 'email');

    // Générer et envoyer OTP SMS
    await this.sendOtp(user.id, 'sms');

    return {
      user,
      message: 'Inscription réussie. Veuillez vérifier votre email et SMS pour les codes OTP.',
    };
  }

  /**
   * Connexion utilisateur (avec email OU téléphone)
   */
  static async login(data: LoginDto) {
    // Chercher l'utilisateur par email ou téléphone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.identifier },
          { phone: data.identifier },
        ],
      },
    });

    if (!user) {
      throw new ApiError(401, 'Identifiants incorrects');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await comparePassword(data.password, user.password);

    if (!isPasswordValid) {
      throw new ApiError(401, 'Identifiants incorrects');
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      throw new ApiError(403, 'Votre compte a été désactivé. Contactez le support.');
    }

    // Générer les tokens
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    // Sauvegarder le refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 jours

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Mettre à jour la date de dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Vérifier le code OTP
   */
  static async verifyOtp(data: VerifyOtpDto) {
    // Chercher le code OTP
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId: data.userId,
        code: data.code,
        type: data.type,
        isUsed: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new ApiError(400, 'Code OTP invalide ou expiré');
    }

    // Marquer le code comme utilisé
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Mettre à jour l'utilisateur comme vérifié
    await prisma.user.update({
      where: { id: data.userId },
      data: { isVerified: true },
    });

    return {
      message: 'Vérification réussie',
    };
  }

  /**
   * Renvoyer un code OTP
   */
  static async resendOtp(data: ResendOtpDto) {
    await this.sendOtp(data.userId, data.type);

    return {
      message: `Code OTP renvoyé par ${data.type === 'email' ? 'email' : 'SMS'}`,
    };
  }

  /**
   * Générer et envoyer un code OTP
   */
  private static async sendOtp(userId: string, type: 'email' | 'sms') {
    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ApiError(404, 'Utilisateur non trouvé');
    }

    // Générer le code OTP
    const code = generateOtp();

    // Calculer la date d'expiration
    const expiresAt = addMinutes(new Date(), OTP_VALIDITY_MINUTES);

    // Sauvegarder le code OTP
    await prisma.otpCode.create({
      data: {
        code,
        userId,
        type,
        expiresAt,
      },
    });

    // Envoyer le code par email ou SMS
    if (type === 'email') {
      await sendEmail({
        to: user.email,
        subject: 'Code de vérification - GroupBuy',
        html: `
          <h2>Votre code de vérification</h2>
          <p>Bonjour ${user.firstName},</p>
          <p>Votre code de vérification est : <strong style="font-size: 24px;">${code}</strong></p>
          <p>Ce code expire dans ${OTP_VALIDITY_MINUTES} minutes.</p>
          <p>Si vous n'avez pas demandé ce code, ignorez ce message.</p>
        `,
      });
    } else {
      await sendSms({
        to: user.phone!,
        message: `GroupBuy: Votre code de vérification est ${code}. Valide ${OTP_VALIDITY_MINUTES} minutes.`,
      });
    }
  }

  /**
   * Demander la réinitialisation du mot de passe
   */
  static async requestResetPassword(data: RequestResetPasswordDto) {
    // Chercher l'utilisateur par email ou téléphone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.identifier },
          { phone: data.identifier },
        ],
      },
    });

    if (!user) {
      // Ne pas révéler que l'utilisateur n'existe pas (sécurité)
      return {
        message: 'Si votre compte existe, vous recevrez un code de réinitialisation.',
      };
    }

    // Envoyer OTP par email et SMS
    await this.sendOtp(user.id, 'email');
    await this.sendOtp(user.id, 'sms');

    return {
      userId: user.id,
      message: 'Code de réinitialisation envoyé par email et SMS.',
    };
  }

  /**
   * Réinitialiser le mot de passe avec code OTP
   */
  static async resetPassword(data: ResetPasswordDto) {
    // Vérifier le code OTP
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId: data.userId,
        code: data.code,
        isUsed: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new ApiError(400, 'Code OTP invalide ou expiré');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await hashPassword(data.newPassword);

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: data.userId },
      data: { password: hashedPassword },
    });

    // Marquer le code comme utilisé
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Supprimer tous les refresh tokens de l'utilisateur
    await prisma.refreshToken.deleteMany({
      where: { userId: data.userId },
    });

    return {
      message: 'Mot de passe réinitialisé avec succès',
    };
  }

  /**
   * Rafraîchir le token d'accès
   */
  static async refreshAccessToken(data: RefreshTokenDto) {
    // Vérifier le refresh token
    const payload = verifyRefreshToken(data.refreshToken);

    if (!payload) {
      throw new ApiError(401, 'Refresh token invalide');
    }

    // Vérifier si le token existe en base
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: data.refreshToken,
        userId: payload.userId,
        expiresAt: {
          gte: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new ApiError(401, 'Refresh token invalide ou expiré');
    }

    if (!tokenRecord.user.isActive) {
      throw new ApiError(403, 'Compte désactivé');
    }

    // Générer un nouveau access token
    const accessToken = generateToken({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.role,
    });

    return {
      accessToken,
    };
  }

  /**
   * Déconnexion (supprimer le refresh token)
   */
  static async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return {
      message: 'Déconnexion réussie',
    };
  }

  /**
   * Obtenir l'utilisateur actuel
   */
  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        address: true,
        city: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'Utilisateur non trouvé');
    }

    return user;
  }
}