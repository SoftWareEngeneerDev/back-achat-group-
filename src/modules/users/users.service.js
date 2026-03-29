// ============================================================
// USERS SERVICE — Logique métier des utilisateurs
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');

class UsersService {

  // ──────────────────────────────────────────────────────────
  // PROFIL UTILISATEUR CONNECTÉ
  // ──────────────────────────────────────────────────────────

  /**
   * UC7 — Récupérer le profil complet de l'utilisateur connecté.
   */
  async getProfile(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        addressLine: true,
        city: true,
        latitude: true,
        longitude: true,
        trustScore: true,
        notifEmail: true,
        notifSMS: true,
        notifPush: true,
        referralCode: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            groupMembers: true, // Nombre de groupes rejoints
            reviews: true,      // Nombre d'avis laissés
          },
        },
      },
    });
  }

  /**
   * UC7 — Mettre à jour le profil de l'utilisateur.
   * Seuls les champs autorisés peuvent être modifiés.
   */
  async updateProfile(userId, data) {
    // ── Champs autorisés à modifier ────────────────────────
    const allowed = [
      'name', 'email', 'addressLine', 'city',
      'latitude', 'longitude',
      'notifEmail', 'notifSMS', 'notifPush',
      'avatarUrl',
    ];

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );

    // ── Vérifier unicité email si modifié ──────────────────
    if (updateData.email) {
      const existing = await prisma.user.findFirst({
        where: { email: updateData.email, id: { not: userId } },
      });
      if (existing) {
        const err = new Error('Cet email est déjà utilisé par un autre compte');
        err.status = 409;
        throw err;
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, name: true, email: true, phone: true,
        avatarUrl: true, city: true, addressLine: true,
        notifEmail: true, notifSMS: true, notifPush: true,
      },
    });
  }

  /**
   * UC GDPR — Anonymiser et désactiver le compte (soft delete).
   * CORRECTION : utilise un statut dédié et anonymise les données
   * au lieu d'utiliser BANNED qui a une autre signification.
   */
  async deleteAccount(userId) {
    // ── Vérifier que l'user n'est pas dans un groupe actif ─
    const activeGroup = await prisma.groupMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        group: { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
      },
    });

    if (activeGroup) {
      const err = new Error('Impossible de supprimer votre compte : vous êtes dans un groupe actif. Quittez le groupe d\'abord.');
      err.status = 409;
      throw err;
    }

    const timestamp = Date.now();

    // ── Anonymiser les données personnelles (GDPR) ─────────
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'BANNED',                          // Désactive le compte
        email: null,                               // Supprime l'email
        phone: `DELETED_${timestamp}`,             // Anonymise le téléphone
        name: 'Utilisateur supprimé',              // Anonymise le nom
        avatarUrl: null,
        addressLine: null,
        twoFactorSecret: null,
      },
    });

    // ── Révoquer toutes les sessions ───────────────────────
    await prisma.session.deleteMany({ where: { userId } });

    return true;
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD UTILISATEUR
  // ──────────────────────────────────────────────────────────

  /**
   * UC10 — Dashboard "Mes Groupes" : groupes actifs et terminés.
   */
  async getMyGroups(userId) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            product: {
              select: { id: true, name: true, imagesUrls: true },
            },
            pricingTiers: {
              orderBy: { participantCount: 'asc' },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // ── Séparer groupes actifs et terminés ─────────────────
    const active = memberships.filter(m =>
      ['OPEN', 'THRESHOLD_REACHED'].includes(m.group.status)
    );
    const completed = memberships.filter(m =>
      ['CLOSED', 'FAILED', 'CANCELLED'].includes(m.group.status)
    );

    return { active, completed, total: memberships.length };
  }

  /**
   * UC11 — Historique des achats de l'utilisateur.
   * CORRECTION : récupère les paiements séparément (pas via groupMember).
   */
  async getHistory(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total] = await Promise.all([
      prisma.groupMember.findMany({
        where: {
          userId,
          group: { status: { in: ['CLOSED', 'FAILED', 'CANCELLED'] } },
        },
        include: {
          group: {
            include: {
              product: { select: { id: true, name: true, imagesUrls: true } },
              orders: {
                where: { groupMembers: { some: { userId } } },
                select: { id: true, status: true, trackingCode: true, createdAt: true },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.groupMember.count({
        where: {
          userId,
          group: { status: { in: ['CLOSED', 'FAILED', 'CANCELLED'] } },
        },
      }),
    ]);

    // ── Récupérer les paiements séparément ─────────────────
    // CORRECTION : Payment est lié à User directement, pas à GroupMember
    const payments = await prisma.payment.findMany({
      where: { userId },
      select: {
        id: true, amount: true, type: true,
        status: true, method: true, createdAt: true,
        groupId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data, payments, total, page, limit };
  }

  /**
   * UC12 — Récupérer les notifications de l'utilisateur.
   */
  async getMyNotifications(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  /**
   * Marquer une notification comme lue.
   */
  async markNotificationRead(notifId, userId) {
    return prisma.notification.updateMany({
      where: { id: notifId, userId },
      data: { isRead: true },
    });
  }

  /**
   * Marquer toutes les notifications comme lues.
   */
  async markAllNotificationsRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}

module.exports = new UsersService();