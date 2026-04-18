const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { success, created, paginated } = require('../../utils/response');
const { validate } = require('../../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Disputes
 *   description: Gestion des litiges et réclamations
 */

/**
 * @swagger
 * /disputes:
 *   post:
 *     tags: [Disputes]
 *     summary: Ouvrir un nouveau litige
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
 *               subject: { type: string, example: "Produit non conforme" }
 *               description: { type: string, example: "Le sac de riz est percé." }
 *               groupId: { type: string, format: uuid }
 *               orderId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Litige ouvert
 */
router.post('/disputes', authenticate, [
  body('subject').notEmpty().isLength({ max: 200 }),
  body('description').notEmpty().isLength({ max: 1000 }),
  body('groupId').optional(),
  body('orderId').optional(),
], validate, async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.create({
      data: {
        userId: req.user.id,
        subject: req.body.subject,
        description: req.body.description,
        groupId: req.body.groupId || null,
        orderId: req.body.orderId || null,
      },
    });
    return created(res, dispute, 'Litige ouvert');
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /disputes/me:
 *   get:
 *     tags: [Disputes]
 *     summary: Historique de mes litiges
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des litiges
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
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_REVIEW, RESOLVED, CLOSED]
 *         description: Filtrer par statut
 *     responses:
 *       200:
 *         description: Liste paginée
 */
router.get('/admin/disputes', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const where = req.query.status ? { status: req.query.status } : {};
    const [data, total] = await Promise.all([
      prisma.dispute.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { user: { select: { name: true, phone: true } } },
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
 *         schema:
 *           type: string
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
 *       200:
 *         description: Litige résolu
 */
router.patch('/admin/disputes/:id/resolve', authenticate, requireAdmin, [
  body('resolution').notEmpty(),
], validate, async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedBy: req.user.id, resolvedAt: new Date() },
    });
    return success(res, dispute, 'Litige résolu');
  } catch (err) { next(err); }
});

module.exports = router;
