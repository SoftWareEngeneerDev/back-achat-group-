const prisma = require('../../config/database');
const { getPagination } = require('../../utils/helpers');

class UsersService {
  async getProfile(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, name: true,
        role: true, status: true, avatarUrl: true,
        addressLine: true, city: true, latitude: true, longitude: true,
        trustScore: true, notifEmail: true, notifSMS: true, notifPush: true,
        referralCode: true, twoFactorEnabled: true,
        createdAt: true, updatedAt: true,
        _count: { select: { groupMembers: true } },
      },
    });
  }

  async updateProfile(userId, data) {
    const allowed = ['name', 'email', 'addressLine', 'city', 'latitude', 'longitude',
      'notifEmail', 'notifSMS', 'notifPush', 'avatarUrl'];
    const updateData = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, city: true, addressLine: true },
    });
  }

  async deleteAccount(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'BANNED', email: null, phone: `DELETED_${Date.now()}` },
    });
  }

  async getMyGroups(userId, query = {}) {
    const { page, limit, skip } = getPagination(query);
    const [data, total] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId },
        include: {
          group: {
            include: {
              product: { select: { id: true, name: true, imagesUrls: true } },
              pricingTiers: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip, take: limit,
      }),
      prisma.groupMember.count({ where: { userId } }),
    ]);
    return { data, total, page, limit };
  }

  async getHistory(userId, query) {
    const { page, limit, skip } = getPagination(query);
    const [data, total] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId, group: { status: { in: ['CLOSED', 'FAILED'] } } },
        include: {
          group: {
            include: {
              product: { select: { id: true, name: true, imagesUrls: true } },
              orders: { select: { id: true, status: true, trackingCode: true } },
            },
          },
          payments: true,
        },
        orderBy: { joinedAt: 'desc' },
        skip, take: limit,
      }),
      prisma.groupMember.count({ where: { userId, group: { status: { in: ['CLOSED', 'FAILED'] } } } }),
    ]);
    return { data, total, page, limit };
  }

  // Admin
  async listUsers(query) {
    const { page, limit, skip } = getPagination(query);
    const where = {};
    if (query.status) where.status = query.status;
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        select: { id: true, name: true, email: true, phone: true, role: true, status: true, trustScore: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateUserStatus(userId, status, adminId) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, name: true, status: true },
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: `USER_STATUS_${status}`, entity: 'User', entityId: userId },
    });
    return user;
  }

  async updateUserRole(userId, role, adminId) {
    if (role !== 'ADMIN') {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (target?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          const err = new Error('Impossible de rétrograder le dernier administrateur');
          err.statusCode = 409;
          throw err;
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, role: true },
    });
    await prisma.auditLog.create({
      data: { userId: adminId, action: `USER_ROLE_CHANGED_TO_${role}`, entity: 'User', entityId: userId },
    });
    return user;
  }
}

module.exports = new UsersService();
