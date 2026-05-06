// ============================================================
// UPLOAD ROUTES — Gestion des images
// Base URL : /api/v1
// ============================================================
const router  = require('express').Router();
const multer  = require('multer');
const uploadService = require('./upload.service');
const { authenticate, requireSupplier } = require('../../middleware/auth');
const { success } = require('../../utils/response');
const prisma = require('../../config/database');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP'), false);
  },
});

// ── Upload images produit (fournisseur) ───────────────────────
router.post(
  '/supplier/upload/images',
  authenticate,
  requireSupplier,
  upload.array('images', 4),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Aucune image fournie', code: 'NO_FILES' } });
      }
      const urls = await uploadService.uploadMultipleImages(req.files, 'products');
      return success(res, { urls, count: urls.length }, 'Images uploadées avec succès');
    } catch (err) { next(err); }
  }
);

// ── Upload avatar — tous les rôles ────────────────────────────
router.post(
  '/users/me/avatar',
  authenticate,
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: { message: 'Aucune image fournie', code: 'NO_FILES' } });
      }
      const urls = await uploadService.uploadMultipleImages([req.file], 'avatars');
      const avatarUrl = urls[0];
      await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl } });
      return success(res, { avatarUrl }, 'Photo de profil mise à jour');
    } catch (err) { next(err); }
  }
);

module.exports = router;