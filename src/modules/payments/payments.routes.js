// ============================================================
// PAYMENTS ROUTES — Paiements et webhooks
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1
// ============================================================

const crypto     = require('crypto');
const router     = require('express').Router();
const { body }   = require('express-validator');
const controller = require('./payments.controller');
const { validate }                    = require('../../middleware/validate');
const { authenticate, requireAdmin }  = require('../../middleware/auth');
const { paymentLimiter }              = require('../../middleware/rateLimit');
const env    = require('../../config/env');
const logger = require('../../utils/logger');

// ── Vérification du secret webhook CinetPay ─────────────────
// Le secret doit être ajouté à l'URL : ?token=CINETPAY_WEBHOOK_SECRET
const verifyWebhookSecret = (req, res, next) => {
  const secret = env.CINETPAY_WEBHOOK_SECRET;
  if (!secret) return next(); // pas de secret configuré → skip (dev)

  const token = req.query.token || req.headers['x-cinetpay-token'];
  if (!token) {
    logger.warn('[WEBHOOK] Token absent');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  // Comparaison en temps constant pour prévenir les timing attacks
  const secretBuf = Buffer.from(secret);
  const tokenBuf  = Buffer.from(token);
  if (secretBuf.length !== tokenBuf.length || !crypto.timingSafeEqual(secretBuf, tokenBuf)) {
    logger.warn('[WEBHOOK] Token invalide');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
};

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Paiements — dépôts, soldes, remboursements et webhooks
 */

// ============================================================
// DÉPÔT — Rejoindre un groupe (UC8)
// ============================================================

/**
 * @swagger
 * /payments/deposit:
 *   post:
 *     tags: [Payments]
 *     summary: UC8 — Initier le paiement du dépôt pour rejoindre un groupe
 *     description: |
 *       Étape 2 du flow de participation (après POST /groups/:id/join).
 *       Crée un paiement PENDING et retourne l'URL CinetPay.
 *       Le membre est confirmé dans le groupe après callback CinetPay.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId, method]
 *             properties:
 *               groupId: { type: string, format: uuid }
 *               method:
 *                 type: string
 *                 enum: [ORANGE_MONEY, MOOV_MONEY, LIGDICASH, CARD, BANK_TRANSFER]
 *                 example: ORANGE_MONEY
 *     responses:
 *       201: { description: URL de paiement CinetPay générée }
 *       409: { description: Groupe complet / déjà membre }
 *       429: { description: Trop de tentatives de paiement }
 */
router.post(
  '/payments/deposit',
  authenticate,
  paymentLimiter, // ← AJOUT : max 10 paiements/heure par userId
  [
    body('groupId').notEmpty().withMessage('ID du groupe requis'),
    body('method')
      .isIn(['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH', 'CARD', 'BANK_TRANSFER'])
      .withMessage('Méthode de paiement invalide'),
  ],
  validate,
  controller.initiateDeposit.bind(controller),
);

// ============================================================
// PAIEMENT FINAL — Solde après seuil atteint (UC15)
// ============================================================

/**
 * @swagger
 * /payments/final:
 *   post:
 *     tags: [Payments]
 *     summary: UC15 — Initier le paiement du solde final
 *     description: |
 *       Disponible uniquement si le groupe est en THRESHOLD_REACHED.
 *       Solde = Prix final - Dépôt déjà payé.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId, method]
 *             properties:
 *               groupId: { type: string, format: uuid }
 *               method:
 *                 type: string
 *                 enum: [ORANGE_MONEY, MOOV_MONEY, LIGDICASH, CARD, BANK_TRANSFER]
 *     responses:
 *       201: { description: URL de paiement final générée }
 *       409: { description: Seuil non atteint / déjà payé }
 *       429: { description: Trop de tentatives de paiement }
 */
router.post(
  '/payments/final',
  authenticate,
  paymentLimiter, // ← AJOUT : max 10 paiements/heure par userId
  [
    body('groupId').notEmpty().withMessage('ID du groupe requis'),
    body('method')
      .isIn(['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH', 'CARD', 'BANK_TRANSFER'])
      .withMessage('Méthode de paiement invalide'),
  ],
  validate,
  controller.initiateFinalPayment.bind(controller),
);

// ============================================================
// HISTORIQUE ET STATUT
// ============================================================

/**
 * @swagger
 * /payments/me:
 *   get:
 *     tags: [Payments]
 *     summary: Historique des paiements de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste paginée des paiements avec détails groupe }
 */
router.get('/payments/me', authenticate, controller.getMyPayments.bind(controller));

/**
 * @swagger
 * /payments/{id}/status:
 *   get:
 *     tags: [Payments]
 *     summary: Statut d'un paiement spécifique
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Détail et statut du paiement }
 *       404: { description: Paiement introuvable }
 */
router.get('/payments/:id/status', authenticate, controller.getPaymentStatus.bind(controller));

// ============================================================
// WEBHOOK CINETPAY — Pas d'auth JWT
// ============================================================

/**
 * @swagger
 * /payments/webhooks/cinetpay:
 *   post:
 *     tags: [Payments]
 *     summary: Webhook CinetPay (callback automatique après paiement)
 *     responses:
 *       200: { description: Webhook traité }
 */
router.post(
  '/payments/webhooks/cinetpay',
  verifyWebhookSecret,
  controller.cinetpayWebhook.bind(controller),
);

// ============================================================
// ADMIN — Remboursements manuels (UC32)
// ============================================================

/**
 * @swagger
 * /admin/payments/refund:
 *   post:
 *     tags: [Payments]
 *     summary: UC32 — Rembourser manuellement un paiement (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentId, reason]
 *             properties:
 *               paymentId: { type: string, format: uuid }
 *               reason:    { type: string, example: "Groupe annulé par admin" }
 *     responses:
 *       200: { description: Remboursement effectué, utilisateur notifié }
 *       409: { description: Paiement déjà remboursé }
 */
router.post(
  '/admin/payments/refund',
  authenticate,
  requireAdmin,
  [
    body('paymentId').notEmpty().withMessage('ID du paiement requis'),
    body('reason').notEmpty().withMessage('Raison du remboursement requise'),
  ],
  validate,
  controller.refund.bind(controller),
);

// ============================================================
// 🧪 SIMULATION — DEV UNIQUEMENT
// ============================================================

/**
 * @swagger
 * /payments/simulate/{transactionRef}:
 *   post:
 *     tags: [Payments]
 *     summary: 🧪 DEV ONLY — Simuler un paiement CinetPay réussi ou échoué
 *     description: |
 *       Simule le callback CinetPay pour tester le flow complet en développement.
 *       Flow complet :
 *       1. POST /groups/{id}/join
 *       2. POST /payments/deposit → récupérer le transactionRef
 *       3. POST /payments/simulate/{transactionRef} → membre confirmé
 *       4. POST /payments/final → récupérer le nouveau transactionRef
 *       5. POST /payments/simulate/{transactionRef} → commande créée
 *     parameters:
 *       - in: path
 *         name: transactionRef
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200: { description: Paiement simulé avec succès }
 *       403: { description: DEV uniquement }
 *       404: { description: Transaction introuvable }
 *       409: { description: Paiement déjà traité }
 */
router.post('/payments/simulate/:transactionRef', async (req, res, next) => {
  try {
    if (!env.IS_DEV) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Route de simulation disponible en DEV uniquement' },
      });
    }

    const { transactionRef } = req.params;
    const success = req.body.success !== false;

    const prisma = require('../../config/database');
    const payment = await prisma.payment.findUnique({ where: { transactionRef } });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Transaction introuvable : ${transactionRef}` },
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: `Paiement déjà traité (statut : ${payment.status})` },
      });
    }

    const simulatedPayload = {
      cpm_trans_id: transactionRef,
      cpm_result: success ? '00' : '01',
      cpm_amount: payment.amount,
      cpm_currency: 'XOF',
      cpm_site_id: 'SIMULATION',
      cpm_payment_date: new Date().toISOString(),
      simulated: true,
    };

    const paymentsService = require('./payments.service');
    await paymentsService.handleCinetPayWebhook(simulatedPayload);

    const updatedPayment = await prisma.payment.findUnique({ where: { transactionRef } });

    return res.status(200).json({
      success: true,
      message: `Paiement ${success ? 'réussi ✅' : 'échoué ❌'} simulé avec succès`,
      data: {
        transactionRef,
        previousStatus: payment.status,
        newStatus: updatedPayment.status,
        amount: payment.amount,
        type: payment.type,
        simulated: true,
      },
    });
  } catch (err) { next(err); }
});

/**
 * @swagger
 * /payments/simulate/status/{transactionRef}:
 *   get:
 *     tags: [Payments]
 *     summary: 🧪 DEV ONLY — Voir le statut d'une transaction
 *     parameters:
 *       - in: path
 *         name: transactionRef
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Détail complet de la transaction }
 *       403: { description: DEV uniquement }
 */
router.get('/payments/simulate/status/:transactionRef', async (req, res, next) => {
  try {
    if (!env.IS_DEV) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Route de simulation disponible en DEV uniquement' },
      });
    }

    const prisma = require('../../config/database');
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: req.params.transactionRef },
      include: {
        group: { include: { product: { select: { name: true } } } },
        user: { select: { name: true, phone: true } },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction introuvable' },
      });
    }

    return res.status(200).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

module.exports = router;