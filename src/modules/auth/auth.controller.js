// ============================================================
// AUTH CONTROLLER — Traitement des requêtes HTTP
// ============================================================

const authService = require('./auth.service');
const prisma      = require('../../config/database');
const env         = require('../../config/env');
const { formatPhone } = require('../../utils/helpers');
const { success, created, error } = require('../../utils/response');

// ── Options communes pour les cookies httpOnly ───────────────
// SameSite=None + Secure requis pour cross-origin (localhost → Railway)
const COOKIE_BASE = {
  httpOnly: true,
  secure  : env.IS_PROD,           // true en prod (HTTPS), false en dev
  sameSite: env.IS_PROD ? 'none' : 'lax',  // 'none' pour cross-origin prod
  path    : '/',
};

const setAuthCookies = (res, tokens) => {
  res.cookie('access_token',  tokens.accessToken,  { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', tokens.refreshToken, { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const clearAuthCookies = (res) => {
  res.clearCookie('access_token',  { path: '/', sameSite: env.IS_PROD ? 'none' : 'lax', secure: env.IS_PROD });
  res.clearCookie('refresh_token', { path: '/', sameSite: env.IS_PROD ? 'none' : 'lax', secure: env.IS_PROD });
};

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
        setAuthCookies(res, tokens);
        return success(res, tokens, 'OTP vérifié avec succès');
      }

      return success(res, null, 'Code OTP vérifié');
    } catch (err) { next(err); }
  }

  /** POST /auth/supplier-profile */
  async updateSupplierProfile(req, res, next) {
    try {
      const { phone, ...profileData } = req.body;

      const user = await prisma.user.findUnique({
        where : { phone: formatPhone(phone) },
        select: { id: true, role: true, status: true },
      });

      if (!user) return error(res, 'Utilisateur introuvable', 404, 'USER_NOT_FOUND');
      if (user.role !== 'SUPPLIER') return error(res, 'Ce compte n\'est pas un compte fournisseur', 403, 'NOT_SUPPLIER');
      if (user.status !== 'SUSPENDED') return error(res, 'Profil déjà configuré ou compte non éligible', 403, 'INVALID_STATUS');

      const result = await authService.updateSupplierProfile(user.id, profileData);
      return success(res, result, 'Profil fournisseur mis à jour');
    } catch (err) { next(err); }
  }

  /** POST /auth/resend-otp */
  async resendOTP(req, res, next) {
    try {
      const { phone, type = 'REGISTER' } = req.body;

      const user = await prisma.user.findUnique({
        where : { phone: formatPhone(phone) },
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
      setAuthCookies(res, result);
      return success(res, result, 'Connexion réussie');
    } catch (err) { next(err); }
  }

  /** POST /auth/refresh */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
      if (!refreshToken) return error(res, 'Refresh token requis', 422, 'VALIDATION_ERROR');
      const tokens = await authService.refresh(refreshToken);
      setAuthCookies(res, tokens);
      return success(res, tokens, 'Token rafraîchi avec succès');
    } catch (err) { next(err); }
  }

  /** POST /auth/logout */
  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;
      await authService.logout(refreshToken);
      clearAuthCookies(res);
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