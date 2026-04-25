// ============================================================
// AUTH CONTROLLER — Traitement des requêtes HTTP
// ============================================================

const authService = require('./auth.service');
const prisma      = require('../../config/database');
const { formatPhone } = require('../../utils/helpers');
const { success, created, error } = require('../../utils/response');

class AuthController {

  /** POST /auth/register */
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      return created(res, user, 'Compte créé. Vérifiez votre SMS pour activer votre compte.');
    } catch (err) { next(err); }
  }

  /** POST /auth/verify-otp */
  async verifyOTP(req, res, next) {
    try {
      const { phone, code, type = 'REGISTER' } = req.body;
      const user = await authService.verifyOTP(phone, code, type);

      if (type === 'REGISTER' || type === 'TWO_FACTOR') {
        if (user.role === 'SUPPLIER' && user.status === 'SUSPENDED') {
          return success(res, {
            supplierPending: true,
            message: 'Compte créé. En attente de validation par l\'administration.',
          }, 'OTP vérifié');
        }
        const tokens = await authService.generateTokens(user);
        return success(res, tokens, 'OTP vérifié avec succès');
      }

      return success(res, null, 'Code OTP vérifié');
    } catch (err) { next(err); }
  }

  /** POST /auth/supplier-profile
   *  CORRECTION : plus de JWT — on identifie le fournisseur par son téléphone
   */
  async updateSupplierProfile(req, res, next) {
    try {
      const { phone, ...profileData } = req.body;

      // Trouver l'utilisateur via son téléphone
      const user = await prisma.user.findUnique({
        where: { phone: formatPhone(phone) },
        select: { id: true, role: true, status: true },
      });

      if (!user) {
        return error(res, 'Utilisateur introuvable', 404, 'USER_NOT_FOUND');
      }

      if (user.role !== 'SUPPLIER') {
        return error(res, 'Ce compte n\'est pas un compte fournisseur', 403, 'NOT_SUPPLIER');
      }

      const result = await authService.updateSupplierProfile(user.id, profileData);
      return success(res, result, 'Profil fournisseur mis à jour');
    } catch (err) { next(err); }
  }

  /** POST /auth/resend-otp */
  async resendOTP(req, res, next) {
    try {
      const { phone, type = 'REGISTER' } = req.body;

      const user = await prisma.user.findUnique({
        where:  { phone: formatPhone(phone) },
        select: { id: true, phone: true, status: true },
      });

      if (!user) return error(res, 'Aucun compte associé à ce numéro', 404, 'USER_NOT_FOUND');

      if (type === 'REGISTER' && user.status !== 'PENDING_VERIFICATION') {
        return error(res, 'Ce compte est déjà vérifié', 400, 'ALREADY_VERIFIED');
      }

      await authService.sendOTP(user.id, user.phone, type);
      return success(res, null, 'Nouveau code OTP envoyé par SMS');
    } catch (err) { next(err); }
  }

  /** POST /auth/login */
  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      if (result.twoFactorRequired) {
        return success(res, { twoFactorRequired: true }, 'Code 2FA envoyé par SMS');
      }
      return success(res, result, 'Connexion réussie');
    } catch (err) { next(err); }
  }

  /** POST /auth/refresh */
  async refresh(req, res, next) {
    try {
      const tokens = await authService.refresh(req.body.refreshToken);
      return success(res, tokens, 'Token rafraîchi avec succès');
    } catch (err) { next(err); }
  }

  /** POST /auth/logout */
  async logout(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      await authService.logout(refreshToken);
      return success(res, null, 'Déconnexion réussie');
    } catch (err) { next(err); }
  }

  /** POST /auth/forgot-password */
  async forgotPassword(req, res, next) {
    try {
      await authService.forgotPassword(req.body.phone);
      return success(res, null, 'Si ce numéro est enregistré, un code vous a été envoyé');
    } catch (err) { next(err); }
  }

  /** POST /auth/reset-password */
  async resetPassword(req, res, next) {
    try {
      const { phone, code, newPassword } = req.body;
      await authService.resetPassword(phone, code, newPassword);
      return success(res, null, 'Mot de passe réinitialisé. Veuillez vous reconnecter.');
    } catch (err) { next(err); }
  }
}

module.exports = new AuthController();