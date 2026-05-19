// ============================================================
// USERS ROUTES — Profil et dashboard utilisateur
// Base URL : /api/v1/users
// ============================================================
const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const { body, param } = require('express-validator');
const controller        = require('./users.controller');
const { validate, sanitizeBody } = require('../../middleware/validate');
const { authenticate }  = require('../../middleware/auth');
const { uploadLimiter } = require('../../middleware/rateLimit');

const upload = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Format non supporté.'));
  },
});

const profileValidators = [
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('city').optional().trim().isLength({ max: 100 }),
  body('addressLine').optional().trim().isLength({ max: 200 }),
  body('notifEmail').optional().isBoolean(),
  body('notifSMS').optional().isBoolean(),
  body('notifPush').optional().isBoolean(),
];

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: 👤 Utilisateurs — Profil, dashboard, notifications
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Obtenir son profil complet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   put:
 *     tags: [Users]
 *     summary: Modifier son profil
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:       { type: string, example: "Kofi Traoré" }
 *               email:      { type: string, format: email }
 *               city:       { type: string, example: "Ouagadougou" }
 *               addressLine:{ type: string }
 *               notifEmail: { type: boolean }
 *               notifSMS:   { type: boolean }
 *               notifPush:  { type: boolean }
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:    { $ref: '#/components/schemas/User' }
 *   delete:
 *     tags: [Users]
 *     summary: Supprimer son compte
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204: { description: Compte supprimé }
 */
router.get   ('/users/me', authenticate, controller.getProfile.bind(controller));
router.put   ('/users/me', authenticate, sanitizeBody, profileValidators, validate, controller.updateProfile.bind(controller));
router.delete('/users/me', authenticate, controller.deleteAccount.bind(controller));

/**
 * @swagger
 * /users/me/avatar:
 *   post:
 *     tags: [Users]
 *     summary: Uploader son avatar (JPG, PNG, WebP — max 5MB)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar mis à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success  : { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatarUrl: { type: string }
 */
router.post('/users/me/avatar', authenticate, uploadLimiter, upload.single('avatar'), controller.uploadAvatar.bind(controller));

/**
 * @swagger
 * /users/me/groups:
 *   get:
 *     tags: [Users]
 *     summary: Mes groupes d'achat (actifs et historique)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des groupes rejoints
 */
router.get('/users/me/groups', authenticate, controller.getMyGroups.bind(controller));

/**
 * @swagger
 * /users/me/history:
 *   get:
 *     tags: [Users]
 *     summary: Historique complet (commandes + paiements)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200: { description: Historique paginé }
 */
router.get('/users/me/history', authenticate, controller.getHistory.bind(controller));

/**
 * @swagger
 * /users/me/stats:
 *   get:
 *     tags: [Users]
 *     summary: Statistiques personnelles (économies, groupes, etc.)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalGroups  : { type: integer }
 *                     totalSaved   : { type: number }
 *                     totalOrders  : { type: integer }
 *                     referralCount: { type: integer }
 *                     trustScore   : { type: number }
 */
router.get('/users/me/stats', authenticate, controller.getStats.bind(controller));

/**
 * @swagger
 * /users/me/notifications:
 *   get:
 *     tags: [Users]
 *     summary: Mes notifications paginées
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *     responses:
 *       200:
 *         description: Liste paginée des notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Notification' }
 *                 meta: { $ref: '#/components/schemas/Pagination' }
 */
router.get('/users/me/notifications', authenticate, controller.getMyNotifications.bind(controller));

/**
 * @swagger
 * /users/me/notifications/read-all:
 *   patch:
 *     tags: [Users]
 *     summary: Marquer toutes les notifications comme lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Toutes les notifications marquées comme lues }
 */
router.patch('/users/me/notifications/read-all', authenticate, controller.markAllNotificationsRead.bind(controller));

/**
 * @swagger
 * /users/me/notifications/{id}/read:
 *   patch:
 *     tags: [Users]
 *     summary: Marquer une notification comme lue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification marquée comme lue }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/users/me/notifications/:id/read',
  authenticate,
  [param('id').notEmpty().withMessage('ID notification requis')],
  validate,
  controller.markNotificationRead.bind(controller)
);

// ============================================================
// PROFIL FOURNISSEUR — /supplier/me
// ============================================================
const { requireSupplier } = require('../../middleware/auth');

const uploadDocs = multer({
  storage   : multer.memoryStorage(),
  limits    : { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Format non supporté.'));
  },
});

router.get('/supplier/me',
  authenticate, requireSupplier,
  controller.getSupplierProfile.bind(controller)
);

router.put('/supplier/me',
  authenticate, requireSupplier,
  sanitizeBody,
  [
    body('companyName').optional().trim().isLength({ min: 2, max: 200 }),
    body('contactName').optional().trim().isLength({ max: 200 }),
    body('address').optional().trim().isLength({ max: 500 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('city').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  controller.updateSupplierProfile.bind(controller)
);

router.post('/supplier/me/logo',
  authenticate, requireSupplier, uploadLimiter,
  upload.single('logo'),
  controller.uploadSupplierLogo.bind(controller)
);

router.post('/supplier/me/documents',
  authenticate, requireSupplier, uploadLimiter,
  uploadDocs.array('documents', 5),
  controller.uploadSupplierDocuments.bind(controller)
);

router.delete('/supplier/me/documents',
  authenticate, requireSupplier,
  [body('url').notEmpty().withMessage('URL requise')],
  validate,
  controller.deleteSupplierDocument.bind(controller)
);

// ============================================================
// RETRAIT FOURNISSEUR
// ============================================================

/**
 * @swagger
 * /supplier/withdrawal:
 *   post:
 *     tags: [Users]
 *     summary: Créer une demande de retrait (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, method, accountInfo]
 *             properties:
 *               amount:      { type: number, example: 50000 }
 *               method:      { type: string, enum: [ORANGE_MONEY, MOOV_MONEY, LIGDICASH] }
 *               accountInfo: { type: string, example: "+22670123456" }
 *     responses:
 *       201: { description: Demande de retrait créée }
 *       400: { description: Paramètres invalides }
 */
router.post('/supplier/withdrawal',
  authenticate, requireSupplier,
  [
    body('amount').isFloat({ min: 1000 }).withMessage('Montant minimum : 1 000 XOF'),
    body('method').isIn(['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH']).withMessage('Méthode invalide'),
    body('accountInfo').notEmpty().trim().withMessage('Numéro de compte requis'),
  ],
  validate,
  controller.createWithdrawalRequest.bind(controller)
);

/**
 * @swagger
 * /supplier/withdrawals:
 *   get:
 *     tags: [Users]
 *     summary: Lister mes demandes de retrait (Fournisseur)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Liste des demandes de retrait }
 */
router.get('/supplier/withdrawals',
  authenticate, requireSupplier,
  controller.getMyWithdrawalRequests.bind(controller)
);

module.exports = router;