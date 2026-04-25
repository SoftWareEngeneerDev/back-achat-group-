// ============================================================
// AUTH ROUTES — Base URL : /api/v1/auth
// ============================================================
const router     = require('express').Router();
const { body }   = require('express-validator');
const controller = require('./auth.controller');
const { validate }    = require('../../middleware/validate');
const { authLimiter, otpLimiter } = require('../../middleware/rateLimit');

// POST /auth/register
router.post('/register',
  authLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('name').trim().notEmpty().withMessage('Nom requis')
      .isLength({ min: 2 }).withMessage('Nom trop court'),
    body('password').isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
    body('email').optional().isEmail().withMessage('Format email invalide'),
    body('referralCode').optional().isString(),
    body('role').optional().isIn(['MEMBER', 'SUPPLIER']).withMessage('Rôle invalide'),
  ],
  validate,
  controller.register.bind(controller),
);

// POST /auth/verify-otp
router.post('/verify-otp',
  otpLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('code')
      .isLength({ min: 6, max: 6 }).withMessage('Code OTP à 6 chiffres')
      .isNumeric().withMessage('Code OTP invalide'),
    body('type').optional()
      .isIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD', 'TWO_FACTOR'])
      .withMessage('Type OTP invalide'),
  ],
  validate,
  controller.verifyOTP.bind(controller),
);

// POST /auth/supplier-profile
// CORRECTION : sans JWT — fournisseur identifié par son téléphone
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

// POST /auth/resend-otp
router.post('/resend-otp',
  otpLimiter,
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('type').optional().isIn(['REGISTER', 'RESET_PASSWORD']),
  ],
  validate,
  controller.resendOTP.bind(controller),
);

// POST /auth/login
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

// POST /auth/refresh
router.post('/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token requis')],
  validate,
  controller.refresh.bind(controller),
);

// POST /auth/logout
router.post('/logout', controller.logout.bind(controller));

// POST /auth/forgot-password
router.post('/forgot-password',
  otpLimiter,
  [body('phone').notEmpty().withMessage('Numéro de téléphone requis')],
  validate,
  controller.forgotPassword.bind(controller),
);

// POST /auth/reset-password
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