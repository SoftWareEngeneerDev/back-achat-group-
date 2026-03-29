// ============================================================
// PAYMENTS CONTROLLER — Traitement des requêtes HTTP
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const paymentsService = require('./payments.service');
const { success, created, notFound } = require('../../utils/response'); // ← CORRECTION : import en haut

class PaymentsController {

  /** POST /payments/deposit — Initier le dépôt pour rejoindre un groupe */
  async initiateDeposit(req, res, next) {
    try {
      const { groupId, method } = req.body;
      const result = await paymentsService.initiateDeposit(req.user.id, groupId, method);
      return created(res, result, 'Paiement du dépôt initié — suivez le lien pour payer');
    } catch (err) { next(err); }
  }

  /** POST /payments/final — Initier le paiement du solde final */
  async initiateFinalPayment(req, res, next) {
    try {
      const { groupId, method } = req.body;
      const result = await paymentsService.initiateFinalPayment(req.user.id, groupId, method);
      return created(res, result, 'Paiement final initié — suivez le lien pour payer');
    } catch (err) { next(err); }
  }

  /** GET /payments/me — Historique des paiements de l'utilisateur */
  async getMyPayments(req, res, next) {
    try {
      const result = await paymentsService.getMyPayments(req.user.id, req.query);
      return success(res, result);
    } catch (err) { next(err); }
  }

  /** GET /payments/:id/status — Statut d'un paiement */
  async getPaymentStatus(req, res, next) {
    try {
      const payment = await paymentsService.getPaymentStatus(req.params.id, req.user.id);
      return success(res, payment);
    } catch (err) { next(err); }
  }

  /**
   * POST /payments/webhooks/cinetpay — Callback CinetPay
   * Pas d'auth JWT — sécurisé par la signature CinetPay.
   * Toujours retourner 200 pour éviter les retry CinetPay.
   */
  async cinetpayWebhook(req, res, next) {
    try {
      await paymentsService.handleCinetPayWebhook(req.body);
      return res.status(200).json({ message: 'OK' });
    } catch (err) {
      // On logue l'erreur mais on retourne 200 quand même
      // pour éviter que CinetPay renvoie le webhook en boucle
      const logger = require('../../utils/logger');
      logger.error('[WEBHOOK] Erreur traitement CinetPay:', err);
      return res.status(200).json({ message: 'OK' });
    }
  }

  /** POST /admin/payments/refund — Remboursement manuel (Admin) */
  async refund(req, res, next) {
    try {
      const { paymentId, reason } = req.body;
      const payment = await paymentsService.refund(paymentId, req.user.id, reason);
      return success(res, payment, 'Remboursement effectué avec succès');
    } catch (err) { next(err); }
  }
}

module.exports = new PaymentsController();