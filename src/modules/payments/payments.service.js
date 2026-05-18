// ============================================================
// PAYMENTS SERVICE — Logique métier des paiements
// Plateforme Achats Groupés — Burkina Faso
// Intégration CinetPay (Orange Money, Moov Money, Ligdicash, Carte)
// Flow : Dépôt (ESCROWED) → Solde final (COMPLETED) → Commande créée
// ============================================================

const axios = require('axios');
const prisma = require('../../config/database');
const env = require('../../config/env');
const { PLATFORM_COMMISSION_RATE } = require('../../config/constants');
const groupsService = require('../groups/groups.service');
const notificationService = require('../notifications/notification.service');
const logger = require('../../utils/logger');

class PaymentsService {

  // ──────────────────────────────────────────────────────────
  // DÉPÔT — Rejoindre un groupe (5-10% du prix)
  // ──────────────────────────────────────────────────────────

  /**
   * UC8 — Initier le paiement du dépôt pour rejoindre un groupe.
   * CORRECTION : Payment lié à userId + groupId (pas groupMemberId).
   * Stocke groupId directement sur le Payment pour le webhook.
   */
  async initiateDeposit(userId, groupId, method) {
    // ── Étape 1 : Vérifier les conditions via groupsService ─
    const joinResult = await groupsService.joinGroup(groupId, userId);
    const { depositAmount, currentPrice } = joinResult;

    // ── Référence unique pour CinetPay ─────────────────────
    const transactionRef = `DEP_${Date.now()}_${userId.slice(0, 8)}`;

    // ── Créer le paiement en base (PENDING) ────────────────
    // CORRECTION : groupId stocké directement, pas groupMemberId
    const payment = await prisma.payment.create({
      data: {
        userId,
        groupId,       // ← CORRECTION : lié au groupe directement
        amount: depositAmount,
        currency: 'XOF',
        method,
        type: 'DEPOSIT',
        status: 'PENDING',
        transactionRef,
      },
    });

    // ── Récupérer le nom du produit pour la description ────
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { product: { select: { name: true } } },
    });

    // ── Initier le paiement CinetPay ───────────────────────
    const cinetpayResponse = await this._initiateCinetPay({
      transactionId: transactionRef,
      amount: depositAmount,
      description: `Dépôt groupe : ${group?.product?.name || 'Achat groupé'}`,
      returnUrl: env.CINETPAY_RETURN_URL,
      notifyUrl: env.CINETPAY_NOTIFY_URL,
    });

    return {
      payment,
      paymentUrl: cinetpayResponse?.data?.payment_url,
      transactionRef,
      depositAmount,
      currentPrice,
    };
  }

  // ──────────────────────────────────────────────────────────
  // PAIEMENT FINAL — Solde après seuil atteint
  // ──────────────────────────────────────────────────────────

  /**
   * UC15 — Initier le paiement du solde final.
   * Disponible uniquement si groupe en THRESHOLD_REACHED.
   * CORRECTION : Payment lié à userId + groupId, pas groupMemberId.
   */
  async initiateFinalPayment(userId, groupId, method) {
    // ── Vérifier la membership ─────────────────────────────
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      include: { group: true },
    });

    if (!member) {
      const err = new Error('Vous n\'êtes pas membre de ce groupe');
      err.status = 404;
      throw err;
    }

    if (member.group.status !== 'THRESHOLD_REACHED') {
      const err = new Error('Le groupe n\'a pas encore atteint son seuil minimum');
      err.status = 409;
      throw err;
    }

    if (member.status === 'PAID') {
      const err = new Error('Vous avez déjà effectué votre paiement final');
      err.status = 409;
      throw err;
    }

    // ── Vérifier qu'il n'y a pas déjà un paiement final en cours ─
    const existingFinal = await prisma.payment.findFirst({
      where: { userId, groupId, type: 'FINAL_PAYMENT', status: { in: ['PENDING', 'COMPLETED'] } },
    });
    if (existingFinal) {
      const err = new Error('Un paiement final est déjà en cours ou complété');
      err.status = 409;
      throw err;
    }

    // ── Calculer le solde restant ──────────────────────────
    const finalAmount = Math.max(0, member.group.currentPrice - member.depositPaid);
    const transactionRef = `FINAL_${Date.now()}_${userId.slice(0, 8)}`;

    // ── Créer le paiement ──────────────────────────────────
    // CORRECTION : groupId directement, pas groupMemberId
    const payment = await prisma.payment.create({
      data: {
        userId,
        groupId,       // ← CORRECTION
        amount: finalAmount,
        currency: 'XOF',
        method,
        type: 'FINAL_PAYMENT',
        status: 'PENDING',
        transactionRef,
      },
    });

    // ── Initier CinetPay ───────────────────────────────────
    const cinetpayResponse = await this._initiateCinetPay({
      transactionId: transactionRef,
      amount: finalAmount,
      description: `Paiement final groupe - ${member.group.title || 'Achat groupé'}`,
    });

    return {
      payment,
      paymentUrl: cinetpayResponse?.data?.payment_url,
      transactionRef,
      finalAmount,
      depositAlreadyPaid: member.depositPaid,
    };
  }

  // ──────────────────────────────────────────────────────────
  // WEBHOOK CINETPAY
  // ──────────────────────────────────────────────────────────

  /**
   * Traitement du callback CinetPay après paiement.
   * CORRECTION : groupId récupéré depuis Payment (pas extrait du transactionRef).
   * CORRECTION : confirmJoinAfterDeposit reçoit depositAmount (nombre).
   */
  async handleCinetPayWebhook(data) {
    const { cpm_trans_id, cpm_result, cpm_amount, cpm_site_id } = data;

    logger.info(`[WEBHOOK] CinetPay reçu - ref: ${cpm_trans_id}, result: ${cpm_result}`);

    // ── Vérifier que le site_id correspond au nôtre ────────
    if (env.CINETPAY_SITE_ID && cpm_site_id && String(cpm_site_id) !== String(env.CINETPAY_SITE_ID)) {
      logger.warn(`[WEBHOOK] Site ID invalide: ${cpm_site_id}`);
      return;
    }

    // ── Trouver le paiement en base ────────────────────────
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: cpm_trans_id },
    });

    if (!payment) {
      logger.warn(`[WEBHOOK] Paiement introuvable pour ref: ${cpm_trans_id}`);
      return;
    }

    // ── Éviter le double traitement ────────────────────────
    if (payment.status !== 'PENDING') {
      logger.warn(`[WEBHOOK] Paiement déjà traité: ${cpm_trans_id} (statut: ${payment.status})`);
      return;
    }

    if (cpm_result === '00') {
      // ── PAIEMENT RÉUSSI ────────────────────────────────────

      if (payment.type === 'DEPOSIT') {
        // Ordre sécurisé : confirmer l'adhésion D'ABORD, puis marquer comme payé.
        // Si confirmJoinAfterDeposit échoue, le paiement reste PENDING → webhook retryable.
        await groupsService.confirmJoinAfterDeposit(
          payment.groupId,
          payment.userId,
          payment.amount,
        );
        await prisma.payment.update({
          where: { id: payment.id },
          data : { status: 'ESCROWED', processedAt: new Date(), gatewayResponse: data },
        });

      } else if (payment.type === 'FINAL_PAYMENT') {
        await prisma.payment.update({
          where: { id: payment.id },
          data : { status: 'COMPLETED', processedAt: new Date(), gatewayResponse: data },
        });
        await this._checkAndCloseGroup(payment.groupId, payment.userId);
      }

    } else {
      // ── PAIEMENT ÉCHOUÉ ────────────────────────────────────
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', gatewayResponse: data },
      });

      await notificationService.notify(payment.userId, {
        type: 'SYSTEM',
        title: '❌ Paiement échoué',
        body: 'Votre paiement n\'a pas abouti. Veuillez réessayer.',
        channels: ['sms'],
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // VÉRIFICATION CLÔTURE GROUPE
  // ──────────────────────────────────────────────────────────

  /**
   * Vérifie si tous les membres ont payé le solde final.
   * Si oui → clôture le groupe et crée la commande.
   * CORRECTION : suppression de closedAt qui n'existe pas dans le schéma.
   */
  async _checkAndCloseGroup(groupId, userId) {
    // ── Marquer ce membre comme PAID ──────────────────────
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { status: 'PAID' },
    });

    // ── Compter les membres payés vs actifs ────────────────
    const [paidCount, activeCount, group] = await Promise.all([
      prisma.groupMember.count({ where: { groupId, status: 'PAID' } }),
      prisma.groupMember.count({ where: { groupId, status: { in: ['ACTIVE', 'PAID'] } } }),
      prisma.group.findUnique({ where: { id: groupId }, include: { supplier: { select: { userId: true } } } }),
    ]);

    logger.info(`[PAYMENT] Groupe ${groupId} : ${paidCount}/${activeCount} membres ont payé`);

    // ── Clôturer si tous les membres actifs ont payé ───────
    if (paidCount >= group.minParticipants && paidCount === activeCount) {
      const totalAmount = group.currentPrice * paidCount;
      const commission = totalAmount * PLATFORM_COMMISSION_RATE;
      const supplierAmount = totalAmount - commission;

      await prisma.$transaction(async (tx) => {
        // ── Clôturer le groupe ─────────────────────────────
        // CORRECTION : pas de closedAt (champ inexistant)
        await tx.group.update({
          where: { id: groupId },
          data: { status: 'CLOSED' },
        });

        // ── Créer la commande ──────────────────────────────
        await tx.order.create({
          data: {
            groupId,
            totalAmount,
            commissionAmount: commission,
            supplierAmount,
            status: 'CREATED',
          },
        });

        // ── Enregistrer la commission plateforme ───────────
        await tx.payment.create({
          data: {
            userId: group.supplier?.userId || userId,
            groupId,
            amount: commission,
            currency: 'XOF',
            type: 'COMMISSION',
            status: 'COMPLETED',
            method: 'BANK_TRANSFER',
            transactionRef: `COMM_${groupId}_${Date.now()}`,
          },
        });
      });

      // ── Notifier tous les membres ──────────────────────────
      await notificationService.notifyGroupMembers(groupId, {
        type: 'GROUP_SUCCESS',
        title: '🎉 Commande créée !',
        body: `Votre commande groupée a été transmise au fournisseur. Montant total : ${totalAmount.toLocaleString()} FCFA`,
        channels: ['sms', 'email'],
      });

      logger.info(`[PAYMENT] Groupe ${groupId} clôturé. Commande créée. Total: ${totalAmount} FCFA`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // LIBÉRATION ESCROW → FOURNISSEUR
  // ──────────────────────────────────────────────────────────

  /**
   * Libère le paiement escrow vers le fournisseur après confirmation de livraison.
   * Crée un enregistrement SUPPLIER_PAYOUT et notifie le fournisseur.
   */
  async releaseEscrow(groupId) {
    const order = await prisma.order.findFirst({
      where  : { groupId, status: 'DELIVERED' },
      include: { group: { include: { supplier: { include: { user: { select: { id: true, name: true } } } } } } },
    });

    if (!order) {
      logger.warn(`[ESCROW] Commande DELIVERED introuvable pour groupId: ${groupId}`);
      return;
    }

    // Vérifier qu'un paiement fournisseur n'a pas déjà été créé
    const existing = await prisma.payment.findFirst({
      where: { groupId, type: 'SUPPLIER_PAYOUT', status: { in: ['PENDING', 'COMPLETED'] } },
    });
    if (existing) {
      logger.warn(`[ESCROW] Paiement fournisseur déjà créé pour groupe: ${groupId}`);
      return;
    }

    const supplierId = order.group?.supplier?.userId ?? order.group?.supplierId;
    if (!supplierId) {
      logger.error(`[ESCROW] Fournisseur introuvable pour groupe: ${groupId}`);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          userId      : supplierId,
          groupId,
          amount      : order.supplierAmount,
          currency    : 'XOF',
          type        : 'SUPPLIER_PAYOUT',
          status      : 'PENDING',
          method      : 'BANK_TRANSFER',
          transactionRef: `PAYOUT_${groupId}_${Date.now()}`,
        },
      });
    });

    const supplierUserId = order.group?.supplier?.user?.id;
    if (supplierUserId) {
      await notificationService.notify(supplierUserId, {
        type    : 'SYSTEM',
        title   : '💰 Paiement en cours de virement',
        body    : `La livraison a été confirmée. Votre virement de ${order.supplierAmount.toLocaleString()} FCFA est en cours de traitement.`,
        channels: ['sms', 'email'],
      }).catch(() => {});
    }

    logger.info(`[ESCROW] Libération escrow créée pour groupe ${groupId} — montant: ${order.supplierAmount} FCFA`);
  }

  // ──────────────────────────────────────────────────────────
  // HISTORIQUE ET STATUT
  // ──────────────────────────────────────────────────────────

  /**
   * Historique paginé des paiements de l'utilisateur connecté.
   */
  async getMyPayments(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          group: {
            include: { product: { select: { name: true } } },
          },
        },
      }),
      prisma.payment.count({ where: { userId } }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Statut d'un paiement spécifique (appartenant à l'utilisateur).
   */
  async getPaymentStatus(paymentId, userId) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, userId },
    });

    if (!payment) {
      const err = new Error('Paiement introuvable');
      err.status = 404;
      throw err;
    }

    return payment;
  }

  // ──────────────────────────────────────────────────────────
  // REMBOURSEMENT ADMIN
  // ──────────────────────────────────────────────────────────

  /**
   * UC32 — Rembourser manuellement un paiement (Admin).
   */
  async refund(paymentId, adminId, reason) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

    if (!payment) {
      const err = new Error('Paiement introuvable');
      err.status = 404;
      throw err;
    }

    if (payment.status === 'REFUNDED') {
      const err = new Error('Ce paiement a déjà été remboursé');
      err.status = 409;
      throw err;
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', processedAt: new Date() },
    });

    // ── Notifier l'utilisateur ────────────────────────────
    await notificationService.notify(payment.userId, {
      type: 'SYSTEM',
      title: '💰 Remboursement effectué',
      body: `Un remboursement de ${payment.amount.toLocaleString()} FCFA a été effectué.${reason ? ` Raison : ${reason}` : ''}`,
      channels: ['sms'],
    });

    // ── Audit log ──────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'MANUAL_REFUND',
        entity: 'Payment',
        entityId: paymentId,
        metadata: { reason, amount: payment.amount },
      },
    });

    return updated;
  }

  // ──────────────────────────────────────────────────────────
  // UTILITAIRE CINETPAY
  // ──────────────────────────────────────────────────────────

  /**
   * Appel à l'API CinetPay pour initier un paiement.
   * En mode DEV → simule une URL de paiement sans appel réel.
   */
  async _initiateCinetPay({ transactionId, amount, description, returnUrl, notifyUrl }) {
    // ── Mode développement : simulation ────────────────────
    if (env.IS_DEV || !env.CINETPAY_API_KEY) {
      logger.debug(`[CINETPAY MOCK] Transaction: ${transactionId} | Amount: ${amount} XOF`);
      return {
        data: {
          payment_url: `http://localhost:${env.PORT}/api/v1/payments/simulate/${transactionId}`,
          code: '201',
          message: 'CREATED',
        },
      };
    }

    // ── Mode production : vrai appel CinetPay ──────────────
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
        customer_name: '',
        customer_surname: '',
      });

      return response.data;
    } catch (error) {
      logger.error('[CINETPAY] Erreur:', error.response?.data || error.message);
      const err = new Error('Erreur lors de l\'initiation du paiement CinetPay');
      err.status = 502;
      throw err;
    }
  }
}

module.exports = new PaymentsService();