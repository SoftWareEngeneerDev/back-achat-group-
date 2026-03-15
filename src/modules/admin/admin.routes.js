const router = require('express').Router();
const { body } = require('express-validator');
const prisma = require('../../config/database');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { success, paginated } = require('../../utils/response');
const { validate } = require('../../middleware/validate');
const { getPagination } = require('../../utils/helpers');

// ============================================================
// GESTION FOURNISSEURS
// ============================================================

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Espace d'administration (Vendeurs, Analytics, GDPR)
 */

/**
 * @swagger
 * /admin/suppliers/pending:
 *   get:
 *     tags: [Admin]
 *     summary: Liste des fournisseurs en attente de validation
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fournisseurs en attente
 */
router.get('/admin/suppliers/pending', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where: { status: 'PENDING' }, skip, take: limit,
        include: { user: { select: { name: true, phone: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.supplier.count({ where: { status: 'PENDING' } }),
    ]);
    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/suppliers/{id}/validate:
 *   patch:
 *     tags: [Admin]
 *     summary: Valider ou rejeter un fournisseur
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
 *             required: [approved]
 *             properties:
 *               approved: { type: boolean }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Fournisseur statué
 */
router.patch('/admin/suppliers/:id/validate', authenticate, requireAdmin, [
  body('approved').isBoolean(),
  body('reason').optional(),
], validate, async (req, res, next) => {
  try {
    const status = req.body.approved ? 'APPROVED' : 'REJECTED';
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { status, validatedAt: req.body.approved ? new Date() : null, validatedBy: req.user.id },
      include: { user: { select: { name: true, role: true } } },
    });
    if (req.body.approved) {
      await prisma.user.update({ where: { id: supplier.userId }, data: { role: 'SUPPLIER' } });
    }
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: `SUPPLIER_${status}`, entity: 'Supplier', entityId: req.params.id },
    });
    return success(res, supplier, `Fournisseur ${req.body.approved ? 'validé' : 'rejeté'}`);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/suppliers:
 *   get:
 *     tags: [Admin]
 *     summary: Liste de tous les fournisseurs validés
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fournisseurs
 */
router.get('/admin/suppliers', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        skip, take: limit,
        include: { user: { select: { name: true, phone: true } }, _count: { select: { products: true, groups: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplier.count(),
    ]);
    return paginated(res, data, page, limit, total);
  } catch (err) { next(err); }
});

// ============================================================
// ANALYTICS
// ============================================================

/**
 * @swagger
 * /admin/analytics/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Statistiques globales du tableau de bord
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Indicateurs clés (KPIs)
 */
router.get('/admin/analytics/dashboard', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [
      totalUsers, activeUsers,
      totalGroups, successGroups, failedGroups, openGroups,
      totalOrders, totalProducts,
      revenueResult,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.group.count(),
      prisma.group.count({ where: { status: 'CLOSED' } }),
      prisma.group.count({ where: { status: 'FAILED' } }),
      prisma.group.count({ where: { status: 'OPEN' } }),
      prisma.order.count(),
      prisma.product.count({ where: { status: 'APPROVED' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', type: 'FINAL_PAYMENT' },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = revenueResult._sum.amount || 0;
    const platformCommission = totalRevenue * 0.07;
    const successRate = totalGroups > 0 ? ((successGroups / totalGroups) * 100).toFixed(1) : 0;

    return success(res, {
      users: { total: totalUsers, active: activeUsers },
      groups: { total: totalGroups, open: openGroups, success: successGroups, failed: failedGroups, successRate: `${successRate}%` },
      orders: { total: totalOrders },
      products: { approved: totalProducts },
      financials: { totalRevenue, platformCommission },
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/analytics/groups:
 *   get:
 *     tags: [Admin]
 *     summary: Répartition des groupes par statut sur 30 jours
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques groupes
 */
router.get('/admin/analytics/groups', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const groups = await prisma.group.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { createdAt: { gte: last30days } },
    });
    return success(res, groups);
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /admin/analytics/payments:
 *   get:
 *     tags: [Admin]
 *     summary: Analyse des paiements (méthode, statut, etc.)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Répartition paiements
 */
router.get('/admin/analytics/payments', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [byMethod, byType] = await Promise.all([
      prisma.payment.groupBy({
        by: ['method', 'status'],
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);
    return success(res, { byMethod, byType });
  } catch (err) { next(err); }
});

// ============================================================
// MONITORING
// ============================================================

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     tags: [Admin]
 *     summary: État de santé du système (BDD, Serveur)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métriques système
 */
router.get('/admin/system/health', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return success(res, {
      status: 'healthy',
      db: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (err) { next(err); }
});

// ============================================================
// BACKUP GDPR
// ============================================================

/**
 * @swagger
 * /admin/backup/export:
 *   post:
 *     tags: [Admin]
 *     summary: Lancer un export GDPR global
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export initié
 */
router.post('/admin/backup/export', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [users, groups, orders] = await Promise.all([
      prisma.user.count(),
      prisma.group.count(),
      prisma.order.count(),
    ]);
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'GDPR_EXPORT', entity: 'System', metadata: { users, groups, orders } },
    });
    return success(res, { message: 'Export GDPR initié', counts: { users, groups, orders } });
  } catch (err) { next(err); }
});

module.exports = router;
