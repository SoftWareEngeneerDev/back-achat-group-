// ============================================================
// PAYMENTS ROUTES — Paiements et webhooks
// Plateforme Achats Groupés — Burkina Faso
// Base URL : /api/v1
// ============================================================

const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./payments.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

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
 *       403: { description: Trust score insuffisant }
 */
router.post(
  '/payments/deposit',
  authenticate,
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
 *       404: { description: Pas membre de ce groupe }
 */
router.post(
  '/payments/final',
  authenticate,
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
 *     description: |
 *       Endpoint appelé automatiquement par CinetPay après chaque paiement.
 *       Pas d'authentification JWT — sécurisé par la signature CinetPay.
 *       Toujours retourne 200 pour éviter les retry.
 *     responses:
 *       200: { description: Webhook traité }
 */
router.post(
  '/payments/webhooks/cinetpay',
  controller.cinetpayWebhook.bind(controller),
  // Pas de authenticate ici — CinetPay n'envoie pas de JWT
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

module.exports = router;