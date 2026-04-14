// ============================================================
// USERS ROUTES — Profil et dashboard utilisateur
// Base URL : /api/v1/users
// ============================================================

const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const { body } = require('express-validator');
const controller = require('./users.controller');
const { validate }    = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

// ── Configuration Multer (upload en mémoire) ──────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext     = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format d\'image non supporté. Utilisez JPG, PNG ou WebP.'));
    }
  },
});

// GET /users/me
router.get('/users/me', authenticate, controller.getProfile.bind(controller));

// PUT /users/me
router.put(
  '/users/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Nom trop court'),
    body('email').optional().isEmail().withMessage('Email invalide'),
    body('city').optional().trim(),
    body('addressLine').optional().trim(),
    body('notifEmail').optional().isBoolean(),
    body('notifSMS').optional().isBoolean(),
    body('notifPush').optional().isBoolean(),
  ],
  validate,
  controller.updateProfile.bind(controller),
);

// POST /users/me/avatar ← NOUVEAU
router.post(
  '/users/me/avatar',
  authenticate,
  upload.single('avatar'),
  controller.uploadAvatar.bind(controller),
);

// DELETE /users/me
router.delete('/users/me', authenticate, controller.deleteAccount.bind(controller));

// GET /users/me/groups
router.get('/users/me/groups', authenticate, controller.getMyGroups.bind(controller));

// GET /users/me/history
router.get('/users/me/history', authenticate, controller.getHistory.bind(controller));

// GET /users/me/notifications
router.get('/users/me/notifications', authenticate, controller.getMyNotifications.bind(controller));

// PATCH /users/me/notifications/read-all
router.patch(
  '/users/me/notifications/read-all',
  authenticate,
  controller.markAllNotificationsRead.bind(controller),
);

// PATCH /users/me/notifications/:id/read
router.patch(
  '/users/me/notifications/:id/read',
  authenticate,
  controller.markNotificationRead.bind(controller),
);

module.exports = router;