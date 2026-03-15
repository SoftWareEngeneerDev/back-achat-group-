const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const env = require('../../config/env');
const { generateOTP, generateReferralCode, getOTPExpiry, formatPhone } = require('../../utils/helpers');
const notificationService = require('../notifications/notification.service');

class AuthService {
  async register({ phone, email, name, password, referralCode }) {
    const formattedPhone = formatPhone(phone);

    const existing = await prisma.user.findUnique({ where: { phone: formattedPhone } });
    if (existing) {
      const err = new Error('Ce numéro de téléphone est déjà utilisé');
      err.status = 409; err.code = 'CONFLICT'; throw err;
    }

    if (email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        const err = new Error('Cet email est déjà utilisé');
        err.status = 409; err.code = 'CONFLICT'; throw err;
      }
    }

    let referredById = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
    const newReferralCode = generateReferralCode(name);

    const user = await prisma.user.create({
      data: {
        phone: formattedPhone,
        email,
        name,
        passwordHash,
        role: 'MEMBER',
        status: 'PENDING_VERIFICATION',
        referralCode: newReferralCode,
        referredById,
      },
      select: { id: true, phone: true, email: true, name: true, status: true },
    });

    await this.sendOTP(user.id, formattedPhone, 'REGISTER');
    return user;
  }

  async sendOTP(userId, phone, type) {
    await prisma.otpCode.updateMany({
      where: { userId, type, used: false },
      data: { used: true },
    });

    const code = generateOTP(env.OTP_LENGTH);
    await prisma.otpCode.create({
      data: { userId, code, type, expiresAt: getOTPExpiry(env.OTP_EXPIRES_IN_MINUTES) },
    });

    await notificationService.sendSMS(phone, `Votre code de vérification : ${code}. Valable ${env.OTP_EXPIRES_IN_MINUTES} minutes.`);
    return true;
  }

  async verifyOTP(phone, code, type) {
    const formattedPhone = formatPhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: formattedPhone } });
    if (!user) { const e = new Error('Utilisateur introuvable'); e.status = 404; throw e; }

    const otp = await prisma.otpCode.findFirst({
      where: { userId: user.id, code, type, used: false, expiresAt: { gt: new Date() } },
    });

    if (!otp) { const e = new Error('Code invalide ou expiré'); e.status = 400; throw e; }

    await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

    if (type === 'REGISTER') {
      await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    }

    return user;
  }

  async login({ phone, email, password }) {
    const formattedPhone = phone ? formatPhone(phone) : null;
    const user = await prisma.user.findFirst({
      where: formattedPhone ? { phone: formattedPhone } : { email },
    });

    if (!user) { const e = new Error('Identifiants incorrects'); e.status = 401; throw e; }
    if (user.status === 'PENDING_VERIFICATION') { const e = new Error('Compte non vérifié, vérifiez votre SMS'); e.status = 403; throw e; }
    if (user.status === 'BANNED' || user.status === 'SUSPENDED') { const e = new Error('Compte désactivé'); e.status = 403; throw e; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { const e = new Error('Identifiants incorrects'); e.status = 401; throw e; }

    if (user.twoFactorEnabled) {
      await this.sendOTP(user.id, user.phone, 'TWO_FACTOR');
      return { twoFactorRequired: true, userId: user.id };
    }

    return this.generateTokens(user);
  }

  async generateTokens(user) {
    const payload = { sub: user.id, role: user.role };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });

    await prisma.session.create({
      data: {
        userId: user.id,
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
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      const e = new Error('Refresh token invalide'); e.status = 401; throw e;
    }

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      const e = new Error('Session expirée'); e.status = 401; throw e;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    await prisma.session.delete({ where: { refreshToken } });
    return this.generateTokens(user);
  }

  async logout(refreshToken) {
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
  }

  async forgotPassword(phone) {
    const formattedPhone = formatPhone(phone);
    const user = await prisma.user.findUnique({ where: { phone: formattedPhone } });
    if (!user) return; // Ne pas révéler si l'utilisateur existe
    await this.sendOTP(user.id, formattedPhone, 'RESET_PASSWORD');
  }

  async resetPassword(phone, code, newPassword) {
    const user = await this.verifyOTP(phone, code, 'RESET_PASSWORD');
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    return true;
  }
}

module.exports = new AuthService();
