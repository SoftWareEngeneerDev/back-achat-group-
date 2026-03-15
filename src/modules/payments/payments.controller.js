const paymentsService = require('./payments.service');
const { success, created } = require('../../utils/response');

class PaymentsController {
  async initiateDeposit(req, res, next) {
    try {
      const { groupId, method } = req.body;
      const result = await paymentsService.initiateDeposit(req.user.id, groupId, method);
      return created(res, result, 'Paiement initié');
    } catch (err) { next(err); }
  }

  async initiateFinalPayment(req, res, next) {
    try {
      const { groupId, method } = req.body;
      const result = await paymentsService.initiateFinalPayment(req.user.id, groupId, method);
      return created(res, result, 'Paiement final initié');
    } catch (err) { next(err); }
  }

  async getMyPayments(req, res, next) {
    try {
      return success(res, await paymentsService.getMyPayments(req.user.id));
    } catch (err) { next(err); }
  }

  async getPaymentStatus(req, res, next) {
    try {
      const payment = await paymentsService.getPaymentStatus(req.params.id, req.user.id);
      if (!payment) return require('../../utils/response').notFound(res, 'Paiement');
      return success(res, payment);
    } catch (err) { next(err); }
  }

  async cinetpayWebhook(req, res, next) {
    try {
      await paymentsService.handleCinetPayWebhook(req.body);
      return res.status(200).json({ message: 'OK' });
    } catch (err) { next(err); }
  }

  async refund(req, res, next) {
    try {
      const payment = await paymentsService.refund(req.body.paymentId, req.user.id, req.body.reason);
      return success(res, payment, 'Remboursement effectué');
    } catch (err) { next(err); }
  }
}

module.exports = new PaymentsController();
