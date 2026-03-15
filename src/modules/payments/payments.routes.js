const router = require('express').Router();
const { body } = require('express-validator');
const controller = require('./payments.controller');
const { validate } = require('../../middleware/validate');
const { authenticate, requireAdmin } = require('../../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Gestion des paiements (Acomptes, Soldes) et webhooks
 */

/**
 * @swagger
 * /payments/deposit:
 *   post:
 *     tags: [Payments]
 *     summary: Initier le paiement de l'acompte pour rejoindre un groupe
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
 *               method: { type: string, enum: [ORANGE_MONEY, MOOV_MONEY, LIGDICASH, CARD] }
 *     responses:
 *       200:
 *         description: URL de paiement ou instruction générée
 */
router.post('/payments/deposit', authenticate, [
  body('groupId').notEmpty(),
  body('method').isIn(['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH', 'CARD']),
], validate, controller.initiateDeposit.bind(controller));

/**
 * @swagger
 * /payments/final:
 *   post:
 *     tags: [Payments]
 *     summary: Initier le paiement du solde (groupe validé)
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
 *               method: { type: string, enum: [ORANGE_MONEY, MOOV_MONEY, LIGDICASH, CARD] }
 *     responses:
 *       200:
 *         description: URL de paiement ou instruction
 */
router.post('/payments/final', authenticate, [
  body('groupId').notEmpty(),
  body('method').isIn(['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH', 'CARD']),
], validate, controller.initiateFinalPayment.bind(controller));

/**
 * @swagger
 * /payments/me:
 *   get:
 *     tags: [Payments]
 *     summary: Historique des paiements de l'utilisateur connecté
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des paiements
 */
router.get('/payments/me', authenticate, controller.getMyPayments.bind(controller));

/**
 * @swagger
 * /payments/{id}/status:
 *   get:
 *     tags: [Payments]
 *     summary: Vérifier le statut d'un paiement spécifique
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut du paiement
 */
router.get('/payments/:id/status', authenticate, controller.getPaymentStatus.bind(controller));

// Webhooks (pas d'auth JWT, sécurisé par signature)

/**
 * @swagger
 * /payments/webhooks/cinetpay:
 *   post:
 *     tags: [Payments]
 *     summary: Webhook de notification CinetPay (usage interne)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook traité
 */
router.post('/payments/webhooks/cinetpay', controller.cinetpayWebhook.bind(controller));

// Admin

/**
 * @swagger
 * /admin/payments/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Rembourser un utilisateur suite à l'annulation d'un groupe (Admin)
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
 *               reason: { type: string, example: "Groupe annulé - Seuils non atteints" }
 *     responses:
 *       200:
 *         description: Remboursement effectué/initié
 */
router.post('/admin/payments/refund', authenticate, requireAdmin, [
  body('paymentId').notEmpty(),
  body('reason').notEmpty(),
], validate, controller.refund.bind(controller));

module.exports = router;
