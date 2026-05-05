// ============================================================
// UPLOAD ROUTES — Gestion des images
// Base URL : /api/v1
// ============================================================
const router  = require('express').Router();
const multer  = require('multer');
const uploadService = require('./upload.service');
const { authenticate, requireSupplier } = require('../../middleware/auth');
const { success } = require('../../utils/response');

// ── Multer — stockage en mémoire (pas sur disque) ─────────────
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize : 5 * 1024 * 1024, // 5MB max par fichier
    files    : 4,                // 4 fichiers max
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP'), false);
    }
  },
});

/**
 * @swagger
 * /supplier/upload/images:
 *   post:
 *     tags: [Supplier]
 *     summary: Uploader 1 à 4 images produit vers Cloudinary
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: 1 à 4 images (JPG, PNG, WEBP — max 5MB chacune)
 *     responses:
 *       200:
 *         description: Images uploadées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     urls:
 *                       type: array
 *                       items: { type: string, format: uri }
 *                     count: { type: integer }
 *       400: { description: Fichier invalide (format, taille) }
 *       403: { description: Non autorisé }
 */
router.post(
  '/supplier/upload/images',
  authenticate,
  requireSupplier,
  upload.array('images', 4),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error  : { message: 'Aucune image fournie', code: 'NO_FILES' }
        });
      }

      const urls = await uploadService.uploadMultipleImages(req.files, 'products');

      return success(res, { urls, count: urls.length }, 'Images uploadées avec succès');
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;