// ============================================================
// RATE LIMITING — Protection contre les abus
// Djula Market — Burkina Faso
// ============================================================

const rateLimit = require('express-rate-limit');

// ── Extracteurs de clé ────────────────────────────────────────
const keyByIP   = (req) => req.ip;
const keyByUser = (req) => req.user?.id || req.ip;

// ── Message d'erreur standardisé ─────────────────────────────
const limitMsg = (message) => ({
  success: false,
  error  : { code: 'RATE_LIMIT', message },
});

// ── Factory pour éviter la répétition ────────────────────────
const makeLimiter = (windowMs, max, keyGenerator, message, skip = undefined) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator,
    standardHeaders: true,
    legacyHeaders  : false,
    message        : limitMsg(message),
    ...(skip && { skip }),
  });

const skipIfNotConnected = (req) => !req.user;

// ============================================================
// LIMITEURS
// ============================================================

/** Global — 100 req / 15 min par IP */
const globalLimiter = makeLimiter(
  15 * 60 * 1000, 100, keyByIP,
  'Trop de requêtes. Réessayez dans 15 minutes.'
);

/** Auth — 5 tentatives / min par IP (anti brute-force) */
const authLimiter = makeLimiter(
  60 * 1000, 5, keyByIP,
  'Trop de tentatives de connexion. Réessayez dans 1 minute.'
);

/** OTP — 3 demandes / min par IP (anti spam SMS) */
const otpLimiter = makeLimiter(
  60 * 1000, 3, keyByIP,
  'Trop de demandes OTP. Réessayez dans 1 minute.'
);

/** Paiement — 10 / heure par userId */
const paymentLimiter = makeLimiter(
  60 * 60 * 1000, 10, keyByUser,
  'Trop de tentatives de paiement. Réessayez dans 1 heure.',
  skipIfNotConnected
);

/** Rejoindre groupe — 5 / heure par userId */
const joinGroupLimiter = makeLimiter(
  60 * 60 * 1000, 5, keyByUser,
  'Vous avez rejoint trop de groupes récemment. Réessayez dans 1 heure.',
  skipIfNotConnected
);

/** Création (produits, groupes, avis, litiges) — 20 / heure par userId */
const createLimiter = makeLimiter(
  60 * 60 * 1000, 20, keyByUser,
  'Trop de créations en peu de temps. Réessayez dans 1 heure.',
  skipIfNotConnected
);

/** Admin — 200 req / 15 min par userId */
const adminLimiter = makeLimiter(
  15 * 60 * 1000, 200, keyByUser,
  'Trop de requêtes admin. Réessayez dans 15 minutes.',
  skipIfNotConnected
);

/** Upload — 10 uploads / heure par userId */
const uploadLimiter = makeLimiter(
  60 * 60 * 1000, 10, keyByUser,
  'Trop d\'uploads en peu de temps. Réessayez dans 1 heure.',
  skipIfNotConnected
);

module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
  joinGroupLimiter,
  createLimiter,
  adminLimiter,
  uploadLimiter,
};