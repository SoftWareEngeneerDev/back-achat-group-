// ============================================================
// AUTH ROUTES — Base URL : /api/v1/auth
// ============================================================
const router     = require('express').Router();
const { body }   = require('express-validator');
const controller = require('./auth.controller');
const { validate }    = require('../../middleware/validate');
const { authLimiter, otpLimiter } = require('../../middleware/rateLimit');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 🔐 Authentification — Inscription, connexion, OTP
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Inscription d'un nouveau membre ou fournisseur
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, name, password]
 *             properties:
 *               phone:       { type: string, example: "+22676528609" }
 *               name:        { type: string, example: "Kofi Traoré" }
 *               password:    { type: string, minLength: 8, example: "motdepasse123" }
 *               email:       { type: string, format: email }
 *               referralCode:{ type: string, example: "KOFI7A2F" }
 *               role:        { type: string, enum: [MEMBER, SUPPLIER], default: MEMBER }
 *     responses:
 *       201:
 *         description: Compte créé — OTP envoyé par SMS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     phone: { type: string, example: "+22676528609" }
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/register',
  authLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('name').trim().notEmpty().withMessage('Nom requis').isLength({ min: 2 }).withMessage('Nom trop court'),
    body('password').isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
    body('email').optional().isEmail().withMessage('Format email invalide'),
    body('referralCode').optional().isString(),
    body('role').optional().isIn(['MEMBER', 'SUPPLIER']).withMessage('Rôle invalide'),
  ],
  validate,
  controller.register.bind(controller),
);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Vérifier le code OTP reçu par SMS
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+22676528609" }
 *               code:  { type: string, example: "123456" }
 *               type:  { type: string, enum: [REGISTER, LOGIN, RESET_PASSWORD, TWO_FACTOR], default: REGISTER }
 *     responses:
 *       200:
 *         description: OTP vérifié — tokens retournés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Code OTP invalide ou expiré
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/verify-otp',
  otpLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Code OTP invalide'),
    body('type').optional().isIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD', 'TWO_FACTOR']),
  ],
  validate,
  controller.verifyOTP.bind(controller),
);

/**
 * @swagger
 * /auth/supplier-profile:
 *   post:
 *     tags: [Auth]
 *     summary: Compléter le profil fournisseur après inscription
 *     description: Appelé après verify-otp pour les comptes fournisseur. Identifié par téléphone (pas de JWT requis).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, companyName]
 *             properties:
 *               phone:       { type: string, example: "+22676528609" }
 *               companyName: { type: string, example: "Tech Ouaga SARL" }
 *               taxId:       { type: string }
 *               siret:       { type: string }
 *               city:        { type: string, example: "Ouagadougou" }
 *               address:     { type: string }
 *     responses:
 *       200:
 *         description: Profil fournisseur créé — en attente de validation admin
 */
router.post('/supplier-profile',
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('companyName').trim().notEmpty().withMessage('Nom de l\'entreprise requis'),
    body('taxId').optional().isString(),
    body('siret').optional().isString(),
    body('city').optional().isString(),
    body('address').optional().isString(),
  ],
  validate,
  controller.updateSupplierProfile.bind(controller),
);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Renvoyer un code OTP par SMS
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+22676528609" }
 *               type:  { type: string, enum: [REGISTER, RESET_PASSWORD], default: REGISTER }
 *     responses:
 *       200: { description: OTP renvoyé }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/resend-otp',
  otpLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('type').optional().isIn(['REGISTER', 'RESET_PASSWORD']),
  ],
  validate,
  controller.resendOTP.bind(controller),
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Connexion avec téléphone/email + mot de passe
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               phone:    { type: string, example: "+22676528609" }
 *               email:    { type: string, format: email }
 *               password: { type: string, example: "motdepasse123" }
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/AuthResponse' }
 *       401: { description: Identifiants incorrects }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/login',
  authLimiter,
  [
    body().custom((_, { req }) => {
      if (!req.body.phone && !req.body.email) throw new Error('Téléphone ou email requis');
      return true;
    }),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  validate,
  controller.login.bind(controller),
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renouveler le token d'accès via refresh token
 *     security: []
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
 *       200:
 *         description: Nouveau token généré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken : { type: string }
 *                     refreshToken: { type: string }
 *                     expiresIn   : { type: integer, example: 900 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token requis')],
  validate,
  controller.refresh.bind(controller),
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Déconnexion — invalide le refresh token
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
router.post('/logout', controller.logout.bind(controller));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Demander un code OTP pour réinitialiser le mot de passe
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+22676528609" }
 *     responses:
 *       200: { description: OTP envoyé par SMS }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/TooManyRequests' }
 */
router.post('/forgot-password',
  otpLimiter,
  [body('phone').notEmpty().withMessage('Numéro de téléphone requis')],
  validate,
  controller.forgotPassword.bind(controller),
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Réinitialiser le mot de passe avec le code OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, newPassword]
 *             properties:
 *               phone:       { type: string, example: "+22676528609" }
 *               code:        { type: string, example: "123456" }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Mot de passe réinitialisé }
 *       400: { description: Code OTP invalide ou expiré }
 */
router.post('/reset-password',
  [
    body('phone').notEmpty(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  controller.resetPassword.bind(controller),
);

module.exports = router;