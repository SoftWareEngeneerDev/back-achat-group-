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

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Inscription d'un nouvel utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, name, password]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               email: { type: string, example: "user@example.com" }
 *               name: { type: string, example: "Kofi Traoré" }
 *               password: { type: string, minLength: 8 }
 *               referralCode: { type: string }
 *     responses:
 *       201: { description: Compte créé, OTP envoyé }
 *       409: { description: Numéro déjà utilisé }
 */
router.post('/register', authLimiter, [
  body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
  body('name').trim().notEmpty().withMessage('Nom requis').isLength({ min: 2 }),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
  body('email').optional().isEmail().withMessage('Email invalide'),
], validate, controller.register.bind(controller));

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Vérification du code OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               code: { type: string, example: "123456" }
 *               type: { type: string, enum: [REGISTER, LOGIN, RESET_PASSWORD, TWO_FACTOR] }
 *     responses:
 *       200: { description: OTP vérifié avec succès }
 */
router.post('/verify-otp', otpLimiter, [
  body('phone').notEmpty(),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code OTP à 6 chiffres'),
  body('type').optional().isIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD', 'TWO_FACTOR']),
], validate, controller.verifyOTP.bind(controller));

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Renvoyer un nouveau code OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               type: { type: string, enum: [REGISTER, RESET_PASSWORD] }
 *     responses:
 *       200: { description: OTP renvoyé avec succès }
 */
router.post('/resend-otp', otpLimiter, [
  body('phone').notEmpty(),
  body('type').optional().isIn(['REGISTER', 'RESET_PASSWORD']),
], validate, controller.resendOTP.bind(controller));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Connexion avec email/téléphone et mot de passe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               email: { type: string, example: "user@example.com" }
 *               password: { type: string, example: "monmotdepasse" }
 *     responses:
 *       200: { description: Succès, retourne les tokens }
 *       401: { description: Identifiants invalides }
 */
router.post('/login', authLimiter, [
  body().custom((_, { req }) => {
    if (!req.body.phone && !req.body.email) throw new Error('Téléphone ou email requis');
    return true;
  }),
  body('password').notEmpty().withMessage('Mot de passe requis'),
], validate, controller.login.bind(controller));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rafraîchir le token d'accès
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
 *       200: { description: Nouveaux tokens générés }
 */
router.post('/refresh', [
  body('refreshToken').notEmpty(),
], validate, controller.refresh.bind(controller));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Déconnexion (invalidate refresh token)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Déconnecté avec succès }
 */
router.post('/logout', controller.logout.bind(controller));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Demander une réinitialisation de mot de passe (Envoie OTP)
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
 *       200: { description: OTP envoyé }
 */
router.post('/forgot-password', otpLimiter, [
  body('phone').notEmpty(),
], validate, controller.forgotPassword.bind(controller));

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Définir un nouveau mot de passe (Utilise OTP)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code, newPassword]
 *             properties:
 *               phone: { type: string, example: "+22670000001" }
 *               code: { type: string, example: "123456" }
 *               newPassword: { type: string, minLength: 8, example: "newpassword123" }
 *     responses:
 *       200: { description: Mot de passe mis à jour }
 */
router.post('/reset-password', [
  body('phone').notEmpty(),
  body('code').isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 8 }),
], validate, controller.resetPassword.bind(controller));

module.exports = router;
