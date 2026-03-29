// ============================================================
// AUTH SERVICE — Logique métier de l'authentification
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const env = require('../../config/env');
const {
  generateOTP,
  generateReferralCode,
  getOTPExpiry,
  formatPhone,
} = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

class AuthService {

  // ──────────────────────────────────────────────────────────
  // INSCRIPTION
  // ──────────────────────────────────────────────────────────

  /**
   * Crée un nouvel utilisateur et envoie un OTP de vérification par SMS.
   * Le compte reste en PENDING_VERIFICATION jusqu'à validation OTP.
   */
  async register({ phone, email, name, password, referralCode }) {
    const formattedPhone = formatPhone(phone);

    // ── Vérification unicité du numéro ─────────────────────
    const existingPhone = await prisma.user.findUnique({
      where: { phone: formattedPhone },
    });
    if (existingPhone) {
      const err = new Error('Ce numéro de téléphone est déjà utilisé');
      err.status = 409;
      err.code = 'PHONE_CONFLICT';
      throw err;
    }

    // ── Vérification unicité email (optionnel) ─────────────
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        const err = new Error('Cet email est déjà utilisé');
        err.status = 409;
        err.code = 'EMAIL_CONFLICT';
        throw err;
      }
    }

    // ── Résolution du parrain (referral) ───────────────────
    let referredById = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredById = referrer.id;
      // Si code invalide, on ignore silencieusement (pas d'erreur)
    }

    // ── Hash du mot de passe ───────────────────────────────
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
    const newReferralCode = generateReferralCode(name);

    // ── Création du compte ─────────────────────────────────
    const user = await prisma.user.create({
      data: {
        phone: formattedPhone,
        email: email || null,
        name,
        passwordHash,
        role: 'MEMBER',
        status: 'PENDING_VERIFICATION',
        referralCode: newReferralCode,
        referredById,
      },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        status: true,
        referralCode: true,
      },
    });

    // ── Envoi OTP de vérification ──────────────────────────
    await this.sendOTP(user.id, formattedPhone, 'REGISTER');

    return user;
  }

  // ──────────────────────────────────────────────────────────
  // GESTION OTP
  // ──────────────────────────────────────────────────────────

  /**
   * Génère et envoie un OTP par SMS.
   * Invalide tous les OTP précédents du même type avant d'en créer un nouveau.
   * SÉCURITÉ : empêche la réutilisation d'anciens codes.
   */
  async sendOTP(userId, phone, type) {
    // ── Invalider les anciens OTP non utilisés du même type ─
    await prisma.otpCode.updateMany({
      where: { userId, type, used: false },
      data: { used: true },
    });

    // ── Créer le nouveau code ──────────────────────────────
    const code = generateOTP(env.OTP_LENGTH || 6);
    await prisma.otpCode.create({
      data: {
        userId,
        code,
        type,
        expiresAt: getOTPExpiry(env.OTP_EXPIRES_IN_MINUTES || 10),
      },
    });

    // ── Envoyer le SMS ─────────────────────────────────────
    const message = `[AchatsGroupesBF] Votre code : ${code}. Valable ${env.OTP_EXPIRES_IN_MINUTES || 10} min. Ne partagez jamais ce code.`;
    await notificationService.sendSMS(phone, message);

    return true;
  }

  /**
   * Vérifie un code OTP.
   * SÉCURITÉ : vérifie que le code n'est pas expiré et pas déjà utilisé.
   * Si type REGISTER → active le compte automatiquement.
   */
  async verifyOTP(phone, code, type) {
    const formattedPhone = formatPhone(phone);

    // ── Trouver l'utilisateur ──────────────────────────────
    const user = await prisma.user.findUnique({
      where: { phone: formattedPhone },
    });
    if (!user) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404;
      throw err;
    }

    // ── Trouver un OTP valide ──────────────────────────────
    const otp = await prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        code,
        type,
        used: false,
        expiresAt: { gt: new Date() }, // Pas encore expiré
      },
    });

    if (!otp) {
      const err = new Error('Code invalide ou expiré');
      err.status = 400;
      err.code = 'INVALID_OTP';
      throw err;
    }

    // ── Marquer l'OTP comme utilisé (usage unique) ─────────
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // ── Activation du compte après vérification inscription ─
    if (type === 'REGISTER') {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      user.status = 'ACTIVE'; // Mettre à jour l'objet local
    }

    return user;
  }

  // ──────────────────────────────────────────────────────────
  // CONNEXION
  // ──────────────────────────────────────────────────────────

  /**
   * Authentifie un utilisateur par téléphone ou email + mot de passe.
   * Si 2FA activé → envoie OTP et retourne twoFactorRequired: true.
   * SÉCURITÉ : même message d'erreur pour user inexistant et mdp incorrect
   *            (évite l'énumération d'utilisateurs).
   */
  async login({ phone, email, password }) {
    const formattedPhone = phone ? formatPhone(phone) : null;

    // ── Recherche de l'utilisateur ─────────────────────────
    const user = await prisma.user.findFirst({
      where: formattedPhone
        ? { phone: formattedPhone }
        : { email },
    });

    // SÉCURITÉ : Message identique que l'user existe ou non
    if (!user) {
      const err = new Error('Identifiants incorrects');
      err.status = 401;
      throw err;
    }

    // ── Vérification du statut du compte ───────────────────
    if (user.status === 'PENDING_VERIFICATION') {
      const err = new Error('Compte non vérifié. Vérifiez votre SMS.');
      err.status = 403;
      err.code = 'PENDING_VERIFICATION';
      throw err;
    }
    if (user.status === 'BANNED') {
      const err = new Error('Compte banni définitivement');
      err.status = 403;
      err.code = 'BANNED';
      throw err;
    }
    if (user.status === 'SUSPENDED') {
      const err = new Error('Compte temporairement suspendu');
      err.status = 403;
      err.code = 'SUSPENDED';
      throw err;
    }

    // ── Vérification du mot de passe ───────────────────────
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // SÉCURITÉ : même message que "user inexistant"
      const err = new Error('Identifiants incorrects');
      err.status = 401;
      throw err;
    }

    // ── Vérification 2FA ───────────────────────────────────
    if (user.twoFactorEnabled) {
      await this.sendOTP(user.id, user.phone, 'TWO_FACTOR');
      // On retourne sans tokens : le client doit d'abord valider le 2FA
      return { twoFactorRequired: true, userId: user.id };
    }

    // ── Génération des tokens ──────────────────────────────
    return this.generateTokens(user);
  }

  // ──────────────────────────────────────────────────────────
  // GESTION DES TOKENS
  // ──────────────────────────────────────────────────────────

  /**
   * Génère access token (15min) + refresh token (7 jours).
   * Stocke le refresh token en base pour permettre la révocation.
   * SÉCURITÉ : rotation des tokens à chaque refresh.
   */
  async generateTokens(user) {
    const payload = { sub: user.id, role: user.role };

    // ── Access token (courte durée — 15min) ────────────────
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN || '15m',
    });

    // ── Refresh token (longue durée — 7 jours) ─────────────
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    // ── Stocker la session en base ─────────────────────────
    // CORRECTION : le champ du schema est "refreshToken" (pas "jwtToken")
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    };
  }

  /**
   * Rafraîchit l'access token via un refresh token valide.
   * SÉCURITÉ : rotation — l'ancien refresh token est supprimé,
   *            un nouveau est créé (détection de vol de token).
   */
  async refresh(refreshToken) {
    // ── Vérifier la signature JWT ──────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      const err = new Error('Refresh token invalide ou expiré');
      err.status = 401;
      throw err;
    }

    // ── Vérifier que la session existe en base ─────────────
    // SÉCURITÉ : si le token a été révoqué (logout), il ne sera plus en base
    const session = await prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      const err = new Error('Session expirée, veuillez vous reconnecter');
      err.status = 401;
      throw err;
    }

    // ── Récupérer l'utilisateur ────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, name: true, role: true, status: true },
    });

    if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') {
      // Supprimer la session si le compte est désactivé
      await prisma.session.delete({ where: { refreshToken } });
      const err = new Error('Compte désactivé');
      err.status = 403;
      throw err;
    }

    // ── Rotation : supprimer l'ancienne session ────────────
    await prisma.session.delete({ where: { refreshToken } });

    // ── Créer de nouveaux tokens ───────────────────────────
    return this.generateTokens(user);
  }

  /**
   * Déconnecte l'utilisateur en révoquant son refresh token.
   * Sans refresh token → logout silencieux (idempotent).
   */
  async logout(refreshToken) {
    if (refreshToken) {
      // Supprimer uniquement cette session (pas toutes)
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
  }

  // ──────────────────────────────────────────────────────────
  // RÉINITIALISATION MOT DE PASSE
  // ──────────────────────────────────────────────────────────

  /**
   * Envoie un OTP de réinitialisation par SMS.
   * SÉCURITÉ : même réponse si l'utilisateur n'existe pas
   *            (empêche l'énumération de numéros).
   */
  async forgotPassword(phone) {
    const formattedPhone = formatPhone(phone);
    const user = await prisma.user.findUnique({
      where: { phone: formattedPhone },
    });

    // SÉCURITÉ : On ne révèle pas si le numéro existe ou non
    if (!user) return;

    await this.sendOTP(user.id, formattedPhone, 'RESET_PASSWORD');
  }

  /**
   * Réinitialise le mot de passe après vérification OTP.
   * Invalide TOUTES les sessions existantes (déconnexion partout).
   */
  async resetPassword(phone, code, newPassword) {
    // ── Vérifier l'OTP de reset ────────────────────────────
    const user = await this.verifyOTP(phone, code, 'RESET_PASSWORD');

    // ── Hasher le nouveau mot de passe ─────────────────────
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

    // ── Mettre à jour le mot de passe ─────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // ── Révoquer TOUTES les sessions (sécurité) ───────────
    // Force la reconnexion sur tous les appareils
    await prisma.session.deleteMany({ where: { userId: user.id } });

    return true;
  }
}

module.exports = new AuthService();