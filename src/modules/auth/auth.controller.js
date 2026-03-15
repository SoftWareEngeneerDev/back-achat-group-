const authService = require('./auth.service');
const { success, created, error } = require('../../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      return created(res, user, 'Compte créé. Vérifiez votre SMS pour activer votre compte.');
    } catch (err) { next(err); }
  }

  async verifyOTP(req, res, next) {
    try {
      const { phone, code, type = 'REGISTER' } = req.body;
      const user = await authService.verifyOTP(phone, code, type);

      if (type === 'TWO_FACTOR' || type === 'REGISTER') {
        const tokens = await authService.generateTokens(user);
        return success(res, tokens, 'Compte vérifié avec succès');
      }
      return success(res, null, 'OTP vérifié');
    } catch (err) { next(err); }
  }

  async resendOTP(req, res, next) {
    try {
      const { phone, type = 'REGISTER' } = req.body;
      const { formatPhone } = require('../../utils/helpers');
      const prisma = require('../../config/database');
      const user = await prisma.user.findUnique({ where: { phone: formatPhone(phone) } });
      if (!user) return error(res, 'Utilisateur introuvable', 404);
      await authService.sendOTP(user.id, user.phone, type);
      return success(res, null, 'OTP renvoyé');
    } catch (err) { next(err); }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      if (result.twoFactorRequired) {
        return success(res, { twoFactorRequired: true }, 'Code 2FA envoyé par SMS');
      }
      return success(res, result, 'Connexion réussie');
    } catch (err) { next(err); }
  }

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refresh(refreshToken);
      return success(res, tokens, 'Token rafraîchi');
    } catch (err) { next(err); }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      return success(res, null, 'Déconnexion réussie');
    } catch (err) { next(err); }
  }

  async forgotPassword(req, res, next) {
    try {
      await authService.forgotPassword(req.body.phone);
      return success(res, null, 'Si ce numéro existe, un code de réinitialisation a été envoyé');
    } catch (err) { next(err); }
  }

  async resetPassword(req, res, next) {
    try {
      const { phone, code, newPassword } = req.body;
      await authService.resetPassword(phone, code, newPassword);
      return success(res, null, 'Mot de passe réinitialisé avec succès');
    } catch (err) { next(err); }
  }
}

module.exports = new AuthController();
