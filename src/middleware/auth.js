const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { JWT_SECRET } = require('../config/env');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * Middleware d'authentification JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Token d\'authentification manquant');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true, email: true, phone: true, name: true,
        role: true, status: true, trustScore: true,
      },
    });

    if (!user) return unauthorized(res, 'Utilisateur introuvable');
    if (user.status === 'BANNED') return forbidden(res, 'Compte banni');
    if (user.status === 'SUSPENDED') return forbidden(res, 'Compte suspendu');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expiré');
    if (err.name === 'JsonWebTokenError') return unauthorized(res, 'Token invalide');
    next(err);
  }
};

/**
 * Middleware optionnel (ne bloque pas si pas de token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, status: true },
    });
    if (user && user.status === 'ACTIVE') req.user = user;
    next();
  } catch {
    next();
  }
};

/**
 * Middleware de vérification de rôle
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Rôle requis : ${roles.join(' ou ')}`);
  }
  next();
};

const requireAdmin = requireRole('ADMIN');
const requireSupplier = requireRole('SUPPLIER', 'ADMIN');
const requireMember = requireRole('MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN');

module.exports = { authenticate, optionalAuth, requireRole, requireAdmin, requireSupplier, requireMember };
