// ============================================================
// USERS SERVICE — Logique métier des utilisateurs
// Djula Market — Burkina Faso
// ============================================================

const bcrypt = require('bcrypt');
const prisma = require('../../config/database');
const path   = require('path');
const fs     = require('fs');
const { getPagination } = require('../../utils/helpers');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'email', 'addressLine', 'city',
  'latitude', 'longitude',
  'notifEmail', 'notifSMS', 'notifPush', 'avatarUrl',
];

// ── Sélection profil — uniquement les champs qui existent ─────
const PROFILE_SELECT = {
  id              : true,
  email           : true,
  phone           : true,
  name            : true,
  role            : true,
  status          : true,
  avatarUrl       : true,
  addressLine     : true,
  city            : true,
  latitude        : true,
  longitude       : true,
  trustScore      : true,
  referralCode    : true,
  notifEmail      : true,
  notifSMS        : true,
  notifPush       : true,
  twoFactorEnabled: true,
  createdAt       : true,
  updatedAt       : true,
  supplier: {
    select: {
      id         : true,
      companyName: true,
      status     : true,
      // ❌ rating, reviewCount, successRate n'existent pas sur Supplier
    },
  },
  _count: { select: { groupMembers: true, reviews: true } },
};

const UPDATE_SELECT = {
  id         : true,
  name       : true,
  email      : true,
  phone      : true,
  avatarUrl  : true,
  city       : true,
  addressLine: true,
  notifEmail : true,
  notifSMS   : true,
  notifPush  : true,
};

class UsersService {

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where : { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404; throw err;
    }
    return user;
  }

  async updateProfile(userId, data) {
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k))
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
      where : { id: userId },
      data  : updateData,
      select: UPDATE_SELECT,
    });
  }

  async uploadAvatar(userId, file) {
    const uploadDir = path.join(__dirname, '../../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const current = await prisma.user.findUnique({
      where : { id: userId },
      select: { avatarUrl: true },
    });
    if (current?.avatarUrl && current.avatarUrl.startsWith('/uploads')) {
      const oldPath = path.join(__dirname, '../../../', current.avatarUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const ext      = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `avatar_${userId}_${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return { avatarUrl };
  }

  async deleteAccount(userId) {
    const activeGroup = await prisma.groupMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        group : { status: { in: ['OPEN', 'THRESHOLD_REACHED'] } },
      },
    });
    if (activeGroup) {
      const err = new Error('Impossible de supprimer votre compte : vous êtes dans un groupe actif.');
      err.status = 409; throw err;
    }

    const pendingPayment = await prisma.payment.findFirst({
      where: { userId, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (pendingPayment) {
      const err = new Error('Impossible de supprimer votre compte : vous avez un paiement en attente.');
      err.status = 409; throw err;
    }

    const timestamp = Date.now();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data : {
          status         : 'BANNED',
          email          : null,
          phone          : `DELETED_${timestamp}`,
          name           : 'Utilisateur supprimé',
          avatarUrl      : null,
          addressLine    : null,
          twoFactorSecret: null,
        },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    return true;
  }

  async getMyGroups(userId) {
    const memberships = await prisma.groupMember.findMany({
      where  : { userId },
      include: {
        group: {
          include: {
            product     : { select: { id: true, name: true, imagesUrls: true } },
            pricingTiers: { orderBy: { participantCount: 'asc' } },
            supplier    : { select: { id: true, companyName: true } },
            _count      : { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const active    = memberships.filter(m => ['OPEN', 'THRESHOLD_REACHED'].includes(m.group.status));
    const completed = memberships.filter(m => ['CLOSED', 'FAILED', 'CANCELLED'].includes(m.group.status));

    return { active, completed, total: memberships.length };
  }

  async getHistory(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total, payments] = await Promise.all([
      prisma.groupMember.findMany({
        where  : { userId, group: { status: { in: ['CLOSED', 'FAILED', 'CANCELLED'] } } },
        include: { group: { include: { product: { select: { id: true, name: true, imagesUrls: true } } } } },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.groupMember.count({
        where: { userId, group: { status: { in: ['CLOSED', 'FAILED', 'CANCELLED'] } } },
      }),
      prisma.payment.findMany({
        where  : { userId },
        select : { id: true, amount: true, type: true, status: true, method: true, createdAt: true, groupId: true },
        orderBy: { createdAt: 'desc' },
        take   : 20,
      }),
    ]);

    return { data, payments, total, page, limit };
  }

  async getMyNotifications(userId, query) {
    const { page, limit, skip } = getPagination(query);

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit };
  }

  async markNotificationRead(notifId, userId) {
    const notif = await prisma.notification.findFirst({ where: { id: notifId, userId } });
    if (!notif) {
      const err = new Error('Notification introuvable'); err.status = 404; throw err;
    }
    return prisma.notification.update({ where: { id: notifId }, data: { isRead: true } });
  }

  async markAllNotificationsRead(userId) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }

  async getMemberStats(userId) {
    const [groupCount, orderCount, payments] = await Promise.all([
      prisma.groupMember.count({ where: { userId } }),
      prisma.order.count({
        where: {
          status: 'DELIVERED',
          group : { members: { some: { userId, status: { in: ['ACTIVE', 'PAID'] } } } },
        },
      }).catch(() => 0),
      // Économies : soloPrice - montant payé (FINAL_PAYMENT uniquement)
      // Note : basePrice n'existe pas dans le schéma — on utilise soloPrice
      prisma.payment.findMany({
        where : { userId, status: 'COMPLETED', type: 'FINAL_PAYMENT' },
        select: { amount: true, group: { select: { product: { select: { soloPrice: true } } } } },
      }).catch(() => []),
    ]);

    const totalSaved = payments.reduce((sum, p) => {
      const soloPrice = p.group?.product?.soloPrice;
      if (!soloPrice) return sum;
      return sum + Math.max(0, soloPrice - p.amount);
    }, 0);

    return {
      totalGroups: groupCount,
      totalOrders: orderCount,
      totalSaved,
    };
  }

  // ── SUPPLIER PROFILE ──────────────────────────────────────

  async getSupplierProfile(userId) {
    const [supplier, reviews] = await Promise.all([
      prisma.supplier.findUnique({
        where  : { userId },
        include: {
          user  : { select: { id: true, name: true, email: true, phone: true, city: true, avatarUrl: true } },
          _count: { select: { products: true, groups: true } },
        },
      }),
      prisma.review.findMany({
        where : { product: { supplier: { userId } } },
        select: { rating: true },
      }),
    ]);

    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 404; throw err;
    }

    const reviewCount = reviews.length;
    const rating      = reviewCount > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
      : 0;

    return { ...supplier, rating, reviewCount };
  }

  async updateSupplierProfile(userId, data) {
    const supplier = await prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 404; throw err;
    }

    const supplierUpdate = {};
    if (data.companyName !== undefined) supplierUpdate.companyName = data.companyName.trim();
    if (data.contactName !== undefined) supplierUpdate.contactName = data.contactName.trim();
    if (data.address     !== undefined) supplierUpdate.address     = data.address.trim();
    if (data.description !== undefined) supplierUpdate.description = data.description.trim();

    const userUpdate = {};
    if (data.email !== undefined) userUpdate.email = data.email.trim() || undefined;
    if (data.city  !== undefined) userUpdate.city  = data.city.trim();

    await prisma.$transaction([
      prisma.supplier.update({ where: { userId }, data: supplierUpdate }),
      ...(Object.keys(userUpdate).length > 0
        ? [prisma.user.update({ where: { id: userId }, data: userUpdate })]
        : []),
    ]);

    return this.getSupplierProfile(userId);
  }

  async uploadSupplierLogo(userId, file, uploadService) {
    const supplier = await prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 404; throw err;
    }
    const urls    = await uploadService.uploadMultipleImages([file], 'logos');
    const logoUrl = urls[0];
    await prisma.supplier.update({ where: { userId }, data: { logoUrl } });
    return { logoUrl };
  }

  async uploadSupplierDocuments(userId, files, uploadService) {
    const supplier = await prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 404; throw err;
    }
    const urls = await uploadService.uploadMultipleImages(files, 'documents');
    const updated = await prisma.supplier.update({
      where: { userId },
      data : { docsUrls: { push: urls } },
    });
    return { urls, docsUrls: updated.docsUrls };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where : { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      const err = new Error('Utilisateur introuvable');
      err.status = 404; throw err;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      const err = new Error('Mot de passe actuel incorrect');
      err.status = 401; throw err;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
  }

  async deleteSupplierDocument(userId, url) {
    const supplier = await prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) {
      const err = new Error('Profil fournisseur introuvable');
      err.status = 404; throw err;
    }
    if (!supplier.docsUrls.includes(url)) {
      const err = new Error('Document introuvable');
      err.status = 404; throw err;
    }
    const updated = await prisma.supplier.update({
      where: { userId },
      data : { docsUrls: supplier.docsUrls.filter(u => u !== url) },
    });
    return { docsUrls: updated.docsUrls };
  }
}

module.exports = new UsersService();