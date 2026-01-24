import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../../middlewares/rateLimit.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Inscription d'un nouvel utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phone
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 example: "+225XXXXXXXXXX"
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [MEMBER, SUPPLIER]
 *     responses:
 *       201:
 *         description: Inscription réussie
 */
router.post(
  '/register',
  rateLimitMiddleware(5, 15), // Max 5 tentatives en 15 minutes
  AuthValidation.validateRegister,
  AuthController.register
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Connexion avec email ou téléphone
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email ou numéro de téléphone
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 */
router.post(
  '/login',
  rateLimitMiddleware(10, 15), // Max 10 tentatives en 15 minutes
  AuthValidation.validateLogin,
  AuthController.login
);

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Vérifier le code OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - code
 *               - type
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *               type:
 *                 type: string
 *                 enum: [email, sms]
 *     responses:
 *       200:
 *         description: Code OTP vérifié
 */
router.post(
  '/verify-otp',
  AuthValidation.validateVerifyOtp,
  AuthController.verifyOtp
);

/**
 * @swagger
 * /api/v1/auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Renvoyer le code OTP
 */
router.post(
  '/resend-otp',
  rateLimitMiddleware(3, 10), // Max 3 renvois en 10 minutes
  AuthValidation.validateResendOtp,
  AuthController.resendOtp
);

/**
 * @swagger
 * /api/v1/auth/request-reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Demander la réinitialisation du mot de passe
 */
router.post(
  '/request-reset-password',
  rateLimitMiddleware(3, 15),
  AuthValidation.validateRequestReset,
  AuthController.requestResetPassword
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Réinitialiser le mot de passe avec code OTP
 */
router.post(
  '/reset-password',
  AuthValidation.validateResetPassword,
  AuthController.resetPassword
);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Rafraîchir le token d'accès
 */
router.post(
  '/refresh-token',
  AuthValidation.validateRefreshToken,
  AuthController.refreshToken
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Déconnexion utilisateur
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/logout',
  authMiddleware,
  AuthController.logout
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtenir les informations de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/me',
  authMiddleware,
  AuthController.getCurrentUser
);

export default router;