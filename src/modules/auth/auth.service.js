// ============================================================
// AUTH SERVICE — Logique métier de l'authentification
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const prisma = require('../../config/database');
const env    = require('../../config/env');
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
  // role = 'MEMBER' (défaut) ou 'SUPPLIER'
  // ──────────────────────────────────────────────────────────
  async register({ phone, email, name, password, referralCode, role = 'MEMBER' }) {
    const formattedPhone = formatPhone(phone);

    const existingPhone = await prisma.user.findUnique({ where: { phone: formattedPhone } });
    if (existingPhone) {
      const err = new Error('Ce numéro de téléphone est déjà utilisé');
      err.status = 409; err.code = 'PHONE_CONFLICT'; throw err;
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        const err = new Error('Cet email est déjà utilisé');
        err.status = 409; err.code = 'EMAIL_CONFLICT'; throw err;
      }
    }

    let referredById = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredById = referrer.id;
    }

    const passwordHash    = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
    const newReferralCode = generateReferralCode(name);

    const user = await prisma.user.create({
      data: {
        phone:        formattedPhone,
        email:        email || null,
        name,
        passwordHash,
        role:         role === 'SUPPLIER' ? 'SUPPLIER' : 'MEMBER',
        status:       'PENDING_VERIFICATION',
        referralCode: newReferralCode,
        referredById,
      },
      select: {
        id: true, phone: true, email: true,
        name: true, status: true, role: true, referralCode: true,
      },
    });

    await this.sendOTP(user.id, formattedPhone, 'REGISTER');
    return user;
  }

  // ──────────────────────────────────────────────────────────
  // VÉRIFICATION OTP
  // ──────────────────────────────────────────────────────────
  async verifyOTP(phone, code, type) {
    const formattedPhone = formatPhone(phone);

    const user = await prisma.user.findUnique({ where: { phone: formattedPhone } });
    if (!user) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404; throw err;
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        userId:    user.id,
        code,
        type,
        used:      false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
      const err = new Error('Code invalide ou expiré');
      err.status = 400; err.code = 'INVALID_OTP'; throw err;
    }

    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

    if (type === 'REGISTER') {
      if (user.role === 'SUPPLIER') {
        // ── Fournisseur → SUSPENDED en attente validation admin ──
        await prisma.user.update({
          where: { id: user.id },
          data:  { status: 'SUSPENDED' },
        });
        user.status = 'SUSPENDED';

        // ── Créer profil Supplier automatiquement ────────────────
        const existing = await prisma.supplier.findUnique({ where: { userId: user.id } });
        if (!existing) {
          await prisma.supplier.create({
            data: {
              userId:         user.id,
              companyName:    user.name,
              status:         'PENDING',
              commissionRate: 0.07,
              docsUrls:       [],
            },
          });
        }

        // ── Notifier les admins ───────────────────────────────────
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await notificationService.notify(admin.id, {
            type:     'SYSTEM',
            title:    '🏪 Nouveau fournisseur en attente',
            body:     `${user.name} s'est inscrit comme fournisseur et attend activation.`,
            channels: ['email'],
          }).catch(() => {});
        }

      } else {
        // ── Membre → ACTIVE directement ──────────────────────────
        await prisma.user.update({
          where: { id: user.id },
          data:  { status: 'ACTIVE' },
        });
        user.status = 'ACTIVE';
      }
    }

    return user;
  }

  // ──────────────────────────────────────────────────────────
  // MISE À JOUR PROFIL FOURNISSEUR
  // Appelé après OTP pour compléter les infos entreprise
  // ──────────────────────────────────────────────────────────
  async updateSupplierProfile(userId, { companyName, taxId, siret, city, address }) {
    const supplier = await prisma.supplier.upsert({
      where:  { userId },
      update: {
        companyName: companyName || undefined,
        taxId:       taxId       || undefined,
        siret:       siret       || undefined,
      },
      create: {
        userId,
        companyName:    companyName || 'Fournisseur',
        taxId:          taxId       || null,
        siret:          siret       || null,
        status:         'PENDING',
        commissionRate: 0.07,
        docsUrls:       [],
      },
    });

    if (city) {
      await prisma.user.update({
        where: { id: userId },
        data:  { city, addressLine: address || undefined },
      });
    }

    return supplier;
  }

  // ──────────────────────────────────────────────────────────
  // ENVOI OTP
  // ──────────────────────────────────────────────────────────
  async sendOTP(userId, phone, type) {
    await prisma.otpCode.updateMany({
      where: { userId, type, used: false },
      data:  { used: true },
    });

    const code = generateOTP(env.OTP_LENGTH || 6);
    await prisma.otpCode.create({
      data: {
        userId,
        code,
        type,
        expiresAt: getOTPExpiry(env.OTP_EXPIRES_IN_MINUTES || 10),
      },
    });

    const message = `[DjulaMarket] Votre code : ${code}. Valable ${env.OTP_EXPIRES_IN_MINUTES || 10} min. Ne partagez jamais ce code.`;
    await notificationService.sendSMS(phone, message);
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // CONNEXION
  // ──────────────────────────────────────────────────────────
  async login({ phone, email, password }) {
    const formattedPhone = phone ? formatPhone(phone) : null;

    const user = await prisma.user.findFirst({
      where: formattedPhone ? { phone: formattedPhone } : { email },
    });

    if (!user) {
      const err = new Error('Identifiants incorrects');
      err.status = 401; throw err;
    }

    if (user.status === 'PENDING_VERIFICATION') {
      const err = new Error('Compte non vérifié. Vérifiez votre SMS.');
      err.status = 403; err.code = 'PENDING_VERIFICATION'; throw err;
    }
    if (user.status === 'SUSPENDED' && user.role === 'SUPPLIER') {
      const err = new Error('Votre compte fournisseur est en attente de validation. Vous recevrez un SMS dès activation.');
      err.status = 403; err.code = 'SUPPLIER_PENDING'; throw err;
    }
    if (user.status === 'SUSPENDED') {
      const err = new Error('Compte temporairement suspendu');
      err.status = 403; err.code = 'SUSPENDED'; throw err;
    }
    if (user.status === 'BANNED') {
      const err = new Error('Compte banni définitivement');
      err.status = 403; err.code = 'BANNED'; throw err;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const err = new Error('Identifiants incorrects');
      err.status = 401; throw err;
    }

    if (user.twoFactorEnabled) {
      await this.sendOTP(user.id, user.phone, 'TWO_FACTOR');
      return { twoFactorRequired: true, userId: user.id };
    }

    return this.generateTokens(user);
  }

  // ──────────────────────────────────────────────────────────
  // TOKENS
  // ──────────────────────────────────────────────────────────
  async generateTokens(user) {
    const payload = { sub: user.id, role: user.role };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN || '15m',
    });
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    await prisma.session.create({
      data: {
        userId:    user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, role: user.role, status: user.status },
    };
  }

  async refresh(refreshToken) {
    let decoded;
    try { decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET); }
    catch {
      const err = new Error('Refresh token invalide ou expiré');
      err.status = 401; throw err;
    }

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      const err = new Error('Session expirée, veuillez vous reconnecter');
      err.status = 401; throw err;
    }

    const user = await prisma.user.findUnique({
      where:  { id: decoded.sub },
      select: { id: true, name: true, role: true, status: true },
    });

    if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') {
      await prisma.session.delete({ where: { refreshToken } });
      const err = new Error('Compte désactivé');
      err.status = 403; throw err;
    }

    await prisma.session.delete({ where: { refreshToken } });
    return this.generateTokens(user);
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
  }

  // ──────────────────────────────────────────────────────────
  // MOT DE PASSE
  // ──────────────────────────────────────────────────────────
  async forgotPassword(phone) {
    const formattedPhone = formatPhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: formattedPhone } });
    if (!user) return;
    await this.sendOTP(user.id, formattedPhone, 'RESET_PASSWORD');
  }

  async resetPassword(phone, code, newPassword) {
    const user         = await this.verifyOTP(phone, code, 'RESET_PASSWORD');
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    return true;
  }
}

module.exports = new AuthService();