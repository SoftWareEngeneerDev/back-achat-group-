// ============================================================
// AUTH CONTROLLER — Traitement des requêtes HTTP
// Plateforme Achats Groupés — Burkina Faso
// ============================================================
// Rôle : reçoit les requêtes, appelle le service, renvoie la réponse.
// Ne contient PAS de logique métier — tout est dans auth.service.js.
// ============================================================

const authService = require('./auth.service');
const prisma = require('../../config/database');         // ← CORRECTION : import en haut du fichier
const { formatPhone } = require('../../utils/helpers'); // ← CORRECTION : import en haut du fichier
const { success, created, error } = require('../../utils/response');

class AuthController {

  /**
   * POST /auth/register
   * Inscription d'un nouvel utilisateur.
   * Crée le compte en PENDING_VERIFICATION et envoie un OTP par SMS.
   */
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      return created(res, user, 'Compte créé. Vérifiez votre SMS pour activer votre compte.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/verify-otp
   * Vérification du code OTP reçu par SMS.
   * Pour REGISTER et TWO_FACTOR → retourne les tokens JWT directement.
   * Pour RESET_PASSWORD → retourne juste une confirmation (pas de tokens).
   */
  async verifyOTP(req, res, next) {
    try {
      const { phone, code, type = 'REGISTER' } = req.body;

      const user = await authService.verifyOTP(phone, code, type);

      // ── Cas REGISTER et TWO_FACTOR : connexion directe après vérification ─
      if (type === 'REGISTER' || type === 'TWO_FACTOR') {
        const tokens = await authService.generateTokens(user);
        return success(res, tokens, 'OTP vérifié avec succès');
      }

      // ── Autres cas (RESET_PASSWORD) : juste confirmer ─────────────────────
      return success(res, null, 'Code OTP vérifié');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/resend-otp
   * Renvoie un nouveau code OTP (invalide l'ancien automatiquement).
   * CORRECTION : les imports sont maintenant en haut du fichier.
   */
  async resendOTP(req, res, next) {
    try {
      const { phone, type = 'REGISTER' } = req.body;

      // ── Vérifier que l'utilisateur existe ─────────────────────────────────
      const user = await prisma.user.findUnique({
        where: { phone: formatPhone(phone) },
        select: { id: true, phone: true, status: true },
      });

      if (!user) {
        return error(res, 'Aucun compte associé à ce numéro', 404, 'USER_NOT_FOUND');
      }

      // ── Vérifier que le renvoi est pertinent selon le statut ──────────────
      if (type === 'REGISTER' && user.status !== 'PENDING_VERIFICATION') {
        return error(res, 'Ce compte est déjà vérifié', 400, 'ALREADY_VERIFIED');
      }

      await authService.sendOTP(user.id, user.phone, type);
      return success(res, null, 'Nouveau code OTP envoyé par SMS');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/login
   * Connexion avec numéro/email + mot de passe.
   * Retourne les tokens JWT ou indique qu'un code 2FA est requis.
   */
  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);

      // ── 2FA activé : le client doit envoyer le code reçu par SMS ─────────
      if (result.twoFactorRequired) {
        return success(res, { twoFactorRequired: true }, 'Code 2FA envoyé par SMS');
      }

      return success(res, result, 'Connexion réussie');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/refresh
   * Rafraîchit l'access token via le refresh token.
   * L'ancien refresh token est révoqué, un nouveau est généré (rotation).
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refresh(refreshToken);
      return success(res, tokens, 'Token rafraîchi avec succès');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/logout
   * Déconnexion : révoque le refresh token en base.
   * Sans refresh token → déconnexion silencieuse (pas d'erreur).
   */
  async logout(req, res, next) {
    try {
      // Le refresh token peut venir du body ou du cookie httpOnly
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      await authService.logout(refreshToken);
      return success(res, null, 'Déconnexion réussie');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/forgot-password
   * Envoie un OTP de réinitialisation par SMS.
   * SÉCURITÉ : même réponse si le numéro n'existe pas (anti-énumération).
   */
  async forgotPassword(req, res, next) {
    try {
      await authService.forgotPassword(req.body.phone);
      // Message volontairement vague pour la sécurité
      return success(res, null, 'Si ce numéro est enregistré, un code vous a été envoyé');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /auth/reset-password
   * Réinitialise le mot de passe après vérification de l'OTP.
   * Révoque toutes les sessions actives (déconnexion partout).
   */
  async resetPassword(req, res, next) {
    try {
      const { phone, code, newPassword } = req.body;
      await authService.resetPassword(phone, code, newPassword);
      return success(res, null, 'Mot de passe réinitialisé. Veuillez vous reconnecter.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();