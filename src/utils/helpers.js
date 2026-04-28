// ============================================================
// HELPERS — Utilitaires métier
// Djula Market — Burkina Faso
// ============================================================

const crypto = require('crypto');

// ============================================================
// OTP & SÉCURITÉ
// ============================================================

/**
 * Génère un code OTP numérique cryptographiquement sûr
 * Utilise crypto.randomInt au lieu de Math.random (plus sûr)
 */
const generateOTP = (length = 6) => {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
};

/** Calcule l'expiration OTP */
const getOTPExpiry = (minutes = 10) =>
  new Date(Date.now() + minutes * 60 * 1000);

// ============================================================
// PARRAINAGE
// ============================================================

/**
 * Génère un code de parrainage unique
 * Format : 3 premières lettres du nom + 6 hex aléatoires
 * Ex : KOF7A2F3
 */
const generateReferralCode = (name) => {
  const prefix = (name || 'USR').substring(0, 4).toUpperCase().replace(/\s/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}${suffix}`;
};

// ============================================================
// PRIX ET PALIERS
// ============================================================

/**
 * Calcule le prix actuel d'un groupe selon les paliers
 * Retourne le prix du palier applicable pour currentCount participants
 */
const calculateCurrentPrice = (pricingTiers, currentCount) => {
  if (!pricingTiers || pricingTiers.length === 0) return null;

  // Trier par nombre de participants décroissant
  const sorted = [...pricingTiers].sort(
    (a, b) => b.participantCount - a.participantCount
  );

  const applicable = sorted.find(t => currentCount >= t.participantCount);
  return applicable
    ? applicable.priceAtTier
    : pricingTiers[pricingTiers.length - 1].priceAtTier; // prix de base (palier minimal)
};

/**
 * Calcule le prochain palier et combien de membres manquent
 */
const getNextTier = (pricingTiers, currentCount) => {
  if (!pricingTiers || pricingTiers.length === 0) return null;

  const sorted = [...pricingTiers].sort(
    (a, b) => a.participantCount - b.participantCount
  );

  const next = sorted.find(t => t.participantCount > currentCount);
  if (!next) return null;

  return {
    price        : next.priceAtTier,
    participants : next.participantCount,
    remaining    : next.participantCount - currentCount,
  };
};

/** Calcule le montant du dépôt (arrondi au supérieur) */
const calculateDeposit = (price, depositPercent) =>
  Math.ceil(price * depositPercent);

/** Calcule le montant du solde final */
const calculateBalance = (price, depositAmount) =>
  Math.max(0, price - depositAmount);

/** Calcule le pourcentage de progression d'un groupe */
const progressPercent = (current, min) => {
  if (!min || min <= 0) return 0;
  return Math.min(100, Math.round((current / min) * 100));
};

// ============================================================
// TÉLÉPHONE
// ============================================================

/**
 * Formater un numéro de téléphone burkinabè → +226XXXXXXXX
 */
const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.toString().replace(/[\s\-\.]/g, '').replace(/^00/, '+');
  if (cleaned.startsWith('+226')) return cleaned;
  if (cleaned.startsWith('226'))  return '+' + cleaned;
  if (cleaned.startsWith('0'))    return '+226' + cleaned.slice(1);
  if (!cleaned.startsWith('+'))   return '+226' + cleaned;
  return cleaned;
};

/** Masquer partiellement un numéro de téléphone */
const maskPhone = (phone) => {
  if (!phone) return '';
  const str = phone.toString();
  return str.slice(0, -4).replace(/\d/g, '*') + str.slice(-4);
};

// ============================================================
// PAGINATION
// ============================================================

/** Extrait et valide les paramètres de pagination depuis query */
const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

// ============================================================
// DIVERS
// ============================================================

/**
 * Génère une référence de transaction unique
 * Format : TXN-YYYYMMDD-XXXXXXXXXX
 */
const generateTxRef = () => {
  const date   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `TXN-${date}-${random}`;
};

/** Arrondit un montant en FCFA (entier) */
const roundFCFA = (amount) => Math.round(amount);

/** Vérifie si une date est expirée */
const isExpired = (date) => new Date(date) < new Date();

/** Délai en ms (pour les timeouts) */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  // OTP
  generateOTP,
  getOTPExpiry,
  // Parrainage
  generateReferralCode,
  // Prix
  calculateCurrentPrice,
  calculateDeposit,
  calculateBalance,
  getNextTier,
  progressPercent,
  // Téléphone
  formatPhone,
  maskPhone,
  // Pagination
  getPagination,
  // Divers
  generateTxRef,
  roundFCFA,
  isExpired,
  sleep,
};