// ============================================================
// USERS ROUTES — Profil et dashboard utilisateur
// Base URL : /api/v1/users
// ============================================================

const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const { body, param } = require('express-validator');

const controller        = require('./users.controller');
const { validate, sanitizeBody } = require('../../middleware/validate');
const { authenticate }  = require('../../middleware/auth');
const { uploadLimiter } = require('../../middleware/rateLimit');

// ── Multer — upload avatar en mémoire ────────────────────────
const upload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext)
      ? cb(null, true)
      : cb(new Error('Format non supporté. Utilisez JPG, PNG ou WebP.'));
  },
});

// ── Validation profil ─────────────────────────────────────────
const profileValidators = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Nom trop court (min. 2 caractères)'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Email invalide'),
  body('city').optional().trim().isLength({ max: 100 }),
  body('addressLine').optional().trim().isLength({ max: 200 }),
  body('notifEmail').optional().isBoolean().withMessage('Valeur booléenne attendue'),
  body('notifSMS').optional().isBoolean().withMessage('Valeur booléenne attendue'),
  body('notifPush').optional().isBoolean().withMessage('Valeur booléenne attendue'),
];

// ============================================================
// PROFIL
// ============================================================

// GET    /users/me
router.get('/users/me', authenticate, controller.getProfile.bind(controller));

// PUT    /users/me
router.put('/users/me',
  authenticate, sanitizeBody, profileValidators, validate,
  controller.updateProfile.bind(controller)
);

// POST   /users/me/avatar
router.post('/users/me/avatar',
  authenticate, uploadLimiter, upload.single('avatar'),
  controller.uploadAvatar.bind(controller)
);

// DELETE /users/me
router.delete('/users/me', authenticate, controller.deleteAccount.bind(controller));

// ============================================================
// DASHBOARD
// ============================================================

// GET /users/me/groups
router.get('/users/me/groups', authenticate, controller.getMyGroups.bind(controller));

// GET /users/me/history
router.get('/users/me/history', authenticate, controller.getHistory.bind(controller));

// GET /users/me/stats
router.get('/users/me/stats', authenticate, controller.getStats.bind(controller));

// ============================================================
// NOTIFICATIONS
// ============================================================

// GET   /users/me/notifications
router.get('/users/me/notifications', authenticate, controller.getMyNotifications.bind(controller));

// PATCH /users/me/notifications/read-all ← AVANT /:id/read pour éviter conflit de routes
router.patch('/users/me/notifications/read-all',
  authenticate,
  controller.markAllNotificationsRead.bind(controller)
);

// PATCH /users/me/notifications/:id/read
router.patch('/users/me/notifications/:id/read',
  authenticate,
  [param('id').notEmpty().withMessage('ID notification requis')],
  validate,
  controller.markNotificationRead.bind(controller)
);

module.exports = router;