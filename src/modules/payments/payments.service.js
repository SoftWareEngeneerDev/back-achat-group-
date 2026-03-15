const axios = require('axios');
const prisma = require('../../config/database');
const env = require('../../config/env');
const { PLATFORM_COMMISSION_RATE } = require('../../config/constants');
const groupsService = require('../groups/groups.service');
const notificationService = require('../notifications/notification.service');
const logger = require('../../utils/logger');

class PaymentsService {
  /**
   * Initier un paiement via CinetPay
   */
  async initiateDeposit(userId, groupId, method) {
    const joinResult = await groupsService.joinGroup(groupId, userId);
    const { depositAmount, group } = joinResult;

    const transactionRef = `DEP_${groupId}_${userId}_${Date.now()}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: depositAmount,
        currency: 'XOF',
        method,
        type: 'DEPOSIT',
        status: 'PENDING',
        transactionRef,
      },
    });

    const cinetpayResponse = await this._initiateCinetPay({
      transactionId: transactionRef,
      amount: depositAmount,
      description: `Dépôt groupe : ${group.product?.name || group.title}`,
      returnUrl: env.CINETPAY_RETURN_URL,
      notifyUrl: env.CINETPAY_NOTIFY_URL,
    });

    return { payment, paymentUrl: cinetpayResponse.data?.payment_url, transactionRef };
  }

  async initiateFinalPayment(userId, groupId, method) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });

    if (!member) { const e = new Error('Vous n\'êtes pas membre de ce groupe'); e.status = 404; throw e; }
    if (member.group.status !== 'THRESHOLD_REACHED') { const e = new Error('Le groupe n\'a pas atteint son seuil'); e.status = 409; throw e; }
    if (member.status === 'PAID') { const e = new Error('Vous avez déjà payé le solde final'); e.status = 409; throw e; }

    const finalAmount = member.group.currentPrice - member.depositPaid;
    const transactionRef = `FINAL_${groupId}_${userId}_${Date.now()}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        groupMemberId: member.id,
        amount: finalAmount,
        currency: 'XOF',
        method,
        type: 'FINAL_PAYMENT',
        status: 'PENDING',
        transactionRef,
      },
    });

    const cinetpayResponse = await this._initiateCinetPay({
      transactionId: transactionRef,
      amount: finalAmount,
      description: `Paiement final groupe`,
    });

    return { payment, paymentUrl: cinetpayResponse.data?.payment_url, transactionRef };
  }

  /**
   * Webhook CinetPay
   */
  async handleCinetPayWebhook(data) {
    const { cpm_trans_id, cpm_result, cpm_amount } = data;

    const payment = await prisma.payment.findUnique({ where: { transactionRef: cpm_trans_id } });
    if (!payment) { logger.warn(`Paiement introuvable: ${cpm_trans_id}`); return; }

    if (cpm_result === '00') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: payment.type === 'DEPOSIT' ? 'ESCROWED' : 'COMPLETED', processedAt: new Date(), gatewayResponse: data },
      });

      if (payment.type === 'DEPOSIT') {
        // Extraire groupId et userId du transactionRef
        const parts = cpm_trans_id.split('_');
        const groupId = parts[1];
        const userId = parts[2];
        await groupsService.confirmJoinAfterDeposit(groupId, userId, payment.id);
      } else if (payment.type === 'FINAL_PAYMENT') {
        await this._checkAndCloseGroup(payment.groupMemberId);
      }
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', gatewayResponse: data },
      });
    }
  }

  async _checkAndCloseGroup(groupMemberId) {
    const member = await prisma.groupMember.findUnique({
      where: { id: groupMemberId },
      include: { group: { include: { members: { where: { status: 'ACTIVE' } } } } },
    });

    await prisma.groupMember.update({ where: { id: groupMemberId }, data: { status: 'PAID' } });

    const allPaid = await prisma.groupMember.count({
      where: { groupId: member.groupId, status: 'ACTIVE' },
    });
    const paidCount = await prisma.groupMember.count({
      where: { groupId: member.groupId, status: 'PAID' },
    });

    if (paidCount >= member.group.minParticipants) {
      const totalAmount = member.group.currentPrice * paidCount;
      const commission = totalAmount * PLATFORM_COMMISSION_RATE;

      await prisma.$transaction(async (tx) => {
        await tx.group.update({ where: { id: member.groupId }, data: { status: 'CLOSED', closedAt: new Date() } });
        await tx.order.create({
          data: {
            groupId: member.groupId,
            totalAmount,
            commissionAmount: commission,
            status: 'CREATED',
          },
        });
      });

      await notificationService.notifyGroupMembers(member.groupId, {
        type: 'GROUP_SUCCESS',
        title: 'Commande créée !',
        body: 'Votre commande groupée a été transmise au fournisseur.',
      });
    }
  }

  async getMyPayments(userId) {
    return prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaymentStatus(paymentId, userId) {
    return prisma.payment.findFirst({ where: { id: paymentId, userId } });
  }

  async refund(paymentId, adminId, reason) {
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: 'MANUAL_REFUND', entity: 'Payment', entityId: paymentId, metadata: { reason } },
    });
    return payment;
  }

  async _initiateCinetPay({ transactionId, amount, description, returnUrl, notifyUrl }) {
    try {
      const response = await axios.post('https://api-checkout.cinetpay.com/v2/payment', {
        apikey: env.CINETPAY_API_KEY,
        site_id: env.CINETPAY_SITE_ID,
        transaction_id: transactionId,
        amount,
        currency: 'XOF',
        description,
        return_url: returnUrl || env.CINETPAY_RETURN_URL,
        notify_url: notifyUrl || env.CINETPAY_NOTIFY_URL,
        channels: 'ALL',
        lang: 'fr',
      });
      return response.data;
    } catch (error) {
      logger.error('CinetPay error:', error.response?.data || error.message);
      // En dev, simuler un succès
      if (env.IS_DEV) return { data: { payment_url: `http://localhost:3000/payment/simulate/${transactionId}` } };
      throw error;
    }
  }
}

module.exports = new PaymentsService();
