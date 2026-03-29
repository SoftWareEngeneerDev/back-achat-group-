// ============================================================
// DISPUTES ROUTES — Litiges et réclamations
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { success, created, paginated } = require('../../utils/response');
const { validate } = require('../../middleware/validate');
const notificationService = require('../notifications/notification.service');

/**
 * @swagger
 * tags:
 *   name: Disputes
 *   description: Litiges et réclamations
 */

/**
 * @swagger
 * /disputes:
 *   post:
 *     tags: [Disputes]
 *     summary: UC26 — Ouvrir un nouveau litige
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject:     { type: string, maxLength: 200, example: "Produit non conforme" }
 *               description: { type: string, maxLength: 1000, example: "Le sac de riz est percé." }
 *               groupId:     { type: string, format: uuid }
 *               orderId:     { type: string, format: uuid }
 *     responses:
 *       201: { description: Litige ouvert }
 */
router.post(
  '/disputes',
  authenticate,
  [
    body('subject').notEmpty().isLength({ max: 200 }).withMessage('Sujet requis (max 200 caractères)'),
    body('description').notEmpty().isLength({ max: 1000 }).withMessage('Description requise (max 1000 caractères)'),
    body('groupId').optional().isUUID(),
    body('orderId').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      // CORRECTION : whitelist des champs autorisés (pas de spread req.body)
      const { subject, description, groupId, orderId } = req.body;

      const dispute = await prisma.dispute.create({
        data: {
          userId: req.user.id,
          subject,
          description,
          groupId: groupId || null,
          orderId: orderId || null,
          status: 'OPEN',
        },
      });

      return created(res, dispute, 'Litige ouvert avec succès');
    } catch (err) { next(err); }
  },
);

/**
 * @swagger
 * /disputes/me:
 *   get:
 *     tags: [Disputes]
 *     summary: Mes litiges
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Liste de mes litiges }
 */
router.get('/disputes/me', authenticate, async (req, res, next) => {
  try {
    const disputes = await prisma.dispute.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, disputes);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     tags: [Disputes]
 *     summary: Liste de tous les litiges (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, IN_REVIEW, RESOLVED, CLOSED] }
 *     responses:
 *       200: { description: Litiges paginés }
 */
router.get('/admin/disputes', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const where = req.query.status ? { status: req.query.status } : {};

    const [data, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispute.count({ where }),
    ]);

    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/disputes/{id}/resolve:
 *   patch:
 *     tags: [Disputes]
 *     summary: Résoudre un litige (Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resolution]
 *             properties:
 *               resolution: { type: string, example: "Remboursement accordé" }
 *     responses:
 *       200: { description: Litige résolu, utilisateur notifié }
 */
router.patch(
  '/admin/disputes/:id/resolve',
  authenticate,
  requireAdmin,
  [
    body('resolution').notEmpty().withMessage('Résolution requise'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const dispute = await prisma.dispute.findUnique({
        where: { id: req.params.id },
      });

      if (!dispute) {
        return require('../../utils/response').notFound(res, 'Litige');
      }

      // CORRECTION : resolvedAt n'existe pas dans le schéma → supprimé
      const updated = await prisma.dispute.update({
        where: { id: req.params.id },
        data: {
          status: 'RESOLVED',
          resolvedBy: req.user.id,
        },
      });

      // ── Notifier l'utilisateur ───────────────────────────
      await notificationService.notify(dispute.userId, {
        type: 'SYSTEM',
        title: '✅ Litige résolu',
        body: `Votre litige a été résolu. Décision : ${req.body.resolution}`,
        channels: ['sms', 'email'],
      });

      return success(res, updated, 'Litige résolu, utilisateur notifié');
    } catch (err) { next(err); }
  },
);

module.exports = router;