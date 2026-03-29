// ============================================================
// AUTH ROUTES — Définition des endpoints d'authentification
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1/auth
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./auth.controller');
const { validate } = require('../../middleware/validate');
const { authLimiter, otpLimiter } = require('../../middleware/rateLimit');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentification et gestion des sessions
 */

// ──────────────────────────────────────────────────────────
// POST /auth/register
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Inscription d'un nouvel utilisateur
 *     description: Crée un compte en PENDING_VERIFICATION et envoie un OTP par SMS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, name, password]
 *             properties:
 *               phone:        { type: string, example: "+22670000001" }
 *               email:        { type: string, example: "user@example.com" }
 *               name:         { type: string, example: "Kofi Traoré" }
 *               password:     { type: string, minLength: 8 }
 *               referralCode: { type: string, example: "KOFI123" }
 *     responses:
 *       201: { description: Compte créé, OTP envoyé par SMS }
 *       409: { description: Numéro ou email déjà utilisé }
 */
router.post(
  '/register',
  authLimiter, // Max 5 tentatives / 15min par IP
  [
    body('phone')
      .notEmpty().withMessage('Numéro de téléphone requis'),
    body('name')
      .trim()
      .notEmpty().withMessage('Nom requis')
      .isLength({ min: 2 }).withMessage('Nom trop court (min 2 caractères)'),
    body('password')
      .isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
    body('email')
      .optional()
      .isEmail().withMessage('Format email invalide'),
    body('referralCode')
      .optional()
      .isString(),
  ],
  validate,
  controller.register.bind(controller),
);

// ──────────────────────────────────────────────────────────
// POST /auth/verify-otp
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Vérification du code OTP reçu par SMS
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               code:  { type: string, example: "123456" }
 *               type:  { type: string, enum: [REGISTER, LOGIN, RESET_PASSWORD, TWO_FACTOR], default: REGISTER }
 *     responses:
 *       200: { description: OTP vérifié, tokens retournés si REGISTER ou TWO_FACTOR }
 *       400: { description: Code invalide ou expiré }
 */
router.post(
  '/verify-otp',
  otpLimiter, // Max 10 tentatives / 15min (anti-bruteforce OTP)
  [
    body('phone')
      .notEmpty().withMessage('Numéro de téléphone requis'),
    body('code')
      .isLength({ min: 6, max: 6 }).withMessage('Le code OTP doit contenir exactement 6 chiffres')
      .isNumeric().withMessage('Le code OTP doit être numérique'),
    body('type')
      .optional()
      .isIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD', 'TWO_FACTOR'])
      .withMessage('Type OTP invalide'),
  ],
  validate,
  controller.verifyOTP.bind(controller),
);

// ──────────────────────────────────────────────────────────
// POST /auth/resend-otp
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Renvoyer un nouveau code OTP (invalide l'ancien)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               type:  { type: string, enum: [REGISTER, RESET_PASSWORD], default: REGISTER }
 *     responses:
 *       200: { description: Nouveau OTP envoyé }
 *       404: { description: Numéro non trouvé }
 */
router.post(
  '/resend-otp',
  otpLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('type')
      .optional()
      .isIn(['REGISTER', 'RESET_PASSWORD'])
      .withMessage('Type invalide pour le renvoi OTP'),
  ],
  validate,
  controller.resendOTP.bind(controller),
);

// ──────────────────────────────────────────────────────────
// POST /auth/login
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Connexion avec téléphone/email + mot de passe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               phone:    { type: string, example: "+22670000001" }
 *               email:    { type: string, example: "user@example.com" }
 *               password: { type: string }
 *     responses:
 *       200: { description: Connexion réussie, retourne accessToken + refreshToken }
 *       401: { description: Identifiants incorrects }
 *       403: { description: Compte non vérifié ou désactivé }
 */
router.post(
  '/login',
  authLimiter,
  [
    // Au moins téléphone ou email doit être fourni
    body().custom((_, { req }) => {
      if (!req.body.phone && !req.body.email) {
        throw new Error('Numéro de téléphone ou email requis');
      }
      return true;
    }),
    body('password')
      .notEmpty().withMessage('Mot de passe requis'),
  ],
  validate,
  controller.login.bind(controller),
);

// ──────────────────────────────────────────────────────────
// POST /auth/refresh
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rafraîchir l'access token via le refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Nouveaux tokens générés (rotation) }
 *       401: { description: Refresh token invalide ou expiré }
 */
router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token requis'),
  ],
  validate,
  controller.refresh.bind(controller),
);

// ──────────────────────────────────────────────────────────
// POST /auth/logout
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Déconnexion (révoque le refresh token)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Déconnexion réussie }
 */
router.post(
  '/logout',
  controller.logout.bind(controller),
  // Pas de validation stricte : logout doit toujours réussir
);

// ──────────────────────────────────────────────────────────
// POST /auth/forgot-password
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Demande de réinitialisation de mot de passe (envoie OTP)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *     responses:
 *       200: { description: OTP envoyé si le numéro existe (réponse identique pour sécurité) }
 */
router.post(
  '/forgot-password',
  otpLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
  ],
  validate,
  controller.forgotPassword.bind(controller),
);

// ──────────────────────────────────────────────────────────
// POST /auth/reset-password
// ──────────────────────────────────────────────────────────
/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Réinitialiser le mot de passe avec le code OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, newPassword]
 *             properties:
 *               phone:       { type: string, example: "+22670000001" }
 *               code:        { type: string, example: "123456" }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Mot de passe mis à jour, toutes sessions révoquées }
 *       400: { description: Code invalide ou expiré }
 */
router.post(
  '/reset-password',
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('code')
      .isLength({ min: 6, max: 6 }).withMessage('Code OTP à 6 chiffres')
      .isNumeric().withMessage('Code OTP invalide'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Nouveau mot de passe minimum 8 caractères'),
  ],
  validate,
  controller.resetPassword.bind(controller),
);

module.exports = router;