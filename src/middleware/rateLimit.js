// ============================================================
// RATE LIMITING — Protection contre les abus
// Plateforme Achats Groupés — Burkina Faso
// ============================================================
// Deux niveaux de protection :
// 1. Par IP (pour les routes publiques et non authentifiées)
// 2. Par userId (pour les routes authentifiées — contourne le changement d'IP)
// ============================================================

const rateLimit = require('express-rate-limit');

// ── Fonction pour extraire la clé (IP ou userId) ────────────
const keyByIP = (req) => req.ip;
const keyByUser = (req) => req.user?.id || req.ip; // userId si connecté, sinon IP

// ── Message d'erreur standardisé ────────────────────────────
const rateLimitResponse = (message) => ({
  success: false,
  error: {
    code: 'RATE_LIMIT',
    message,
  },
});

// ============================================================
// GLOBAL — Toutes les routes (par IP)
// 100 requêtes / 15 minutes
// ============================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: keyByIP,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Trop de requêtes. Réessayez dans 15 minutes.'),
});

// ============================================================
// AUTH — Inscription et connexion (par IP)
// 5 tentatives / minute — anti brute-force
// ============================================================
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: keyByIP,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Trop de tentatives de connexion. Réessayez dans 1 minute.'),
});

// ============================================================
// OTP — Envoi et vérification de codes SMS (par IP)
// 3 tentatives / minute — anti spam SMS
// ============================================================
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  keyGenerator: keyByIP,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Trop de demandes OTP. Réessayez dans 1 minute.'),
});

// ============================================================
// PAIEMENT — Initiation de paiements (par userId)
// 10 paiements / heure par utilisateur
// Empêche le spam de paiements même avec changement d'IP
// ============================================================
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  keyGenerator: keyByUser,  // ← Par userId, pas par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Trop de tentatives de paiement. Réessayez dans 1 heure.'),
  skip: (req) => !req.user, // Ignorer si pas connecté (géré par authLimiter)
});

// ============================================================
// GROUPE — Rejoindre des groupes (par userId)
// 5 groupes rejoints / heure par utilisateur
// ============================================================
const joinGroupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  keyGenerator: keyByUser,  // ← Par userId
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Vous avez rejoint trop de groupes récemment. Réessayez dans 1 heure.'),
  skip: (req) => !req.user,
});

// ============================================================
// CRÉATION — Créer des ressources (par userId)
// 20 créations / heure (produits, groupes, avis, litiges)
// ============================================================
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  keyGenerator: keyByUser,  // ← Par userId
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Trop de créations en peu de temps. Réessayez dans 1 heure.'),
  skip: (req) => !req.user,
});

// ============================================================
// ADMIN — Routes admin (par userId)
// 200 requêtes / 15 minutes — plus permissif pour l'admin
// ============================================================
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: keyByUser,  // ← Par userId admin
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Trop de requêtes admin. Réessayez dans 15 minutes.'),
  skip: (req) => !req.user,
});

module.exports = {
  globalLimiter,
  authLimiter,
  otpLimiter,
  paymentLimiter,
  joinGroupLimiter,
  createLimiter,
  adminLimiter,
};