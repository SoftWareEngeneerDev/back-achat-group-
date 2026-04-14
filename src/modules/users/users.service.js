// ============================================================
// USERS SERVICE — Logique métier des utilisateurs
// ============================================================

const prisma = require('../../config/database');
const path   = require('path');
const fs     = require('fs');
const { getPagination } = require('../../utils/helpers');

class UsersService {

  // ──────────────────────────────────────────────────────────
  // PROFIL
  // ──────────────────────────────────────────────────────────

  async getProfile(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, name: true,
        role: true, status: true, avatarUrl: true,
        addressLine: true, city: true,
        latitude: true, longitude: true,
        trustScore: true,
        notifEmail: true, notifSMS: true, notifPush: true,
        referralCode: true, twoFactorEnabled: true,
        createdAt: true, updatedAt: true,
        supplier: {
          select: {
            id: true, companyName: true, status: true,
            rating: true, reviewCount: true, successRate: true,
          },
        },
        _count: {
          select: { groupMembers: true, reviews: true },
        },
      },
    });
  }

  async updateProfile(userId, data) {
    const allowed = [
      'name', 'email', 'addressLine', 'city',
      'latitude', 'longitude',
      'notifEmail', 'notifSMS', 'notifPush', 'avatarUrl',
    ];

    const updateData = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowed.includes(k))
    );

    if (updateData.email) {
      const existing = await prisma.user.findFirst({
        where: { email: updateData.email, id: { not: userId } },
      });
      if (existing) {
        const err = new Error('Cet email est déjà utilisé par un autre compte');
        err.status = 409; throw err;
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data:  updateData,
      select: {
        id: true, name: true, email: true, phone: true,
        avatarUrl: true, city: true, addressLine: true,
        notifEmail: true, notifSMS: true, notifPush: true,
      },
    });
  }

  // ──────────────────────────────────────────────────────────
  // UPLOAD AVATAR ← NOUVEAU
  // ──────────────────────────────────────────────────────────

  async uploadAvatar(userId, file) {
    // ── Créer le dossier uploads si inexistant ────────────────
    const uploadDir = path.join(__dirname, '../../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ── Générer un nom de fichier unique ──────────────────────
    const ext      = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `avatar_${userId}_${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // ── Sauvegarder le fichier ────────────────────────────────
    fs.writeFileSync(filepath, file.buffer);

    // ── URL publique du fichier ───────────────────────────────
    const avatarUrl = `/uploads/avatars/${filename}`;

    // ── Mettre à jour l'URL en base ───────────────────────────
    await prisma.user.update({
      where: { id: userId },
      data:  { avatarUrl },
    });

    return { avatarUrl };
  }

  // ──────────────────────────────────────────────────────────
  // SUPPRESSION COMPTE
  // ──────────────────────────────────────────────────────────

  async deleteAccount(userId) {
    const activeGroup = await prisma.groupMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        group: { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
      },
    });

    if (activeGroup) {
      const err = new Error('Impossible de supprimer votre compte : vous êtes dans un groupe actif.');
      err.status = 409; throw err;
    }

    const timestamp = Date.now();
    await prisma.user.update({
      where: { id: userId },
      data: {
        status:          'BANNED',
        email:           null,
        phone:           `DELETED_${timestamp}`,
        name:            'Utilisateur supprimé',
        avatarUrl:       null,
        addressLine:     null,
        twoFactorSecret: null,
      },
    });

    await prisma.session.deleteMany({ where: { userId } });
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // DASHBOARD
  // ──────────────────────────────────────────────────────────

  async getMyGroups(userId) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            product:      { select: { id: true, name: true, imagesUrls: true } },
            pricingTiers: { orderBy: { participantCount: 'asc' } },
            _count:       { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const active = memberships.filter(m =>
      ['OPEN', 'THRESHOLD_REACHED'].includes(m.group.status)
    );
    const completed = memberships.filter(m =>
      ['CLOSED', 'FAILED', 'CANCELLED'].includes(m.group.status)
    );

    return { active, completed, total: memberships.length };
  }

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

    const payments = await prisma.payment.findMany({
      where:   { userId },
      select: {
        id: true, amount: true, type: true,
        status: true, method: true, createdAt: true, groupId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data, payments, total, page, limit };
  }

  // ──────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────────────────────────────────────

  async getMyNotifications(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  async markNotificationRead(notifId, userId) {
    return prisma.notification.updateMany({
      where: { id: notifId, userId },
      data:  { isRead: true },
    });
  }

  async markAllNotificationsRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });
  }
}

module.exports = new UsersService();