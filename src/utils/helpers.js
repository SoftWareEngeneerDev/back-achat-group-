const crypto = require('crypto');

/**
 * Génère un code OTP numérique
 */
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

/**
 * Génère un code de parrainage unique
 */
const generateReferralCode = (name) => {
  const prefix = name.substring(0, 3).toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
};

/**
 * Calcule le prix actuel d'un groupe selon les paliers
 */
const calculateCurrentPrice = (pricingTiers, currentCount) => {
  if (!pricingTiers || pricingTiers.length === 0) return null;
  const sorted = [...pricingTiers].sort((a, b) => b.participantCount - a.participantCount);
  const applicableTier = sorted.find(t => currentCount >= t.participantCount);
  return applicableTier ? applicableTier.priceAtTier : pricingTiers[0].priceAtTier;
};

/**
 * Calcule le montant du dépôt
 */
const calculateDeposit = (price, depositPercent) => {
  return Math.ceil(price * depositPercent);
};

/**
 * Pagination helper
 */
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Formater un numéro de téléphone burkinabè
 */
const formatPhone = (phone) => {
  const cleaned = phone.replace(/\s/g, '').replace(/^00/, '+');
  if (!cleaned.startsWith('+')) {
    return `+226${cleaned}`;
  }
  return cleaned;
};

/**
 * Masquer partiellement un numéro de téléphone
 */
const maskPhone = (phone) => {
  if (!phone) return '';
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
};

/**
 * Calculer l'expiration OTP
 */
const getOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

module.exports = {
  generateOTP,
  generateReferralCode,
  calculateCurrentPrice,
  calculateDeposit,
  getPagination,
  formatPhone,
  maskPhone,
  getOTPExpiry,
};
