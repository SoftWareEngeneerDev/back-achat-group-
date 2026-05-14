// ============================================================
// AUTH MIDDLEWARE — Vérification JWT et contrôle des rôles
// Djula Market — Burkina Faso
// ============================================================

const jwt    = require('jsonwebtoken');
const prisma = require('../config/database');
const { JWT_SECRET } = require('../config/env');
const { unauthorized, forbidden } = require('../utils/response');

// ── Sélection minimale pour chaque requête authentifiée ──────
const USER_SELECT = {
  id              : true,
  email           : true,
  phone           : true,
  name            : true,
  role            : true,
  status          : true,
  trustScore      : true,
  twoFactorEnabled: true,
};

// ── Extraire le token : cookie httpOnly en priorité, sinon Bearer header ─
const extractToken = (req) => {
  if (req.cookies?.access_token) return req.cookies.access_token;
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.split(' ')[1];
};

// ============================================================
// authenticate — Vérifie JWT + statut du compte
// ============================================================
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return unauthorized(res, 'Token d\'authentification manquant');

    // Vérification JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Chargement depuis DB — détecte les changements de statut en temps réel
    const user = await prisma.user.findUnique({
      where : { id: decoded.sub },
      select: USER_SELECT,
    });

    if (!user) return unauthorized(res, 'Utilisateur introuvable');

    // Vérification du statut
    const statusErrors = {
      PENDING_VERIFICATION : 'Compte non vérifié. Vérifiez votre SMS.',
      BANNED               : 'Compte banni définitivement.',
      SUSPENDED            : 'Compte temporairement suspendu. Contactez le support.',
    };

    if (statusErrors[user.status]) {
      return forbidden(res, statusErrors[user.status]);
    }

    req.user = user;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Session expirée. Veuillez vous reconnecter.');
    }
    if (err.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Token invalide.');
    }
    next(err);
  }
};

// ============================================================
// optionalAuth — JWT optionnel, ne bloque pas si absent
// ============================================================
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    const user    = await prisma.user.findUnique({
      where : { id: decoded.sub },
      select: { id: true, role: true, status: true },
    });

    // Seulement les comptes actifs bénéficient du contexte user
    if (user && user.status === 'ACTIVE') req.user = user;

    next();
  } catch {
    next(); // Token invalide/expiré → continuer sans user
  }
};

// ============================================================
// requireRole — Vérifie le(s) rôle(s) autorisé(s)
// Doit être utilisé APRÈS authenticate
// ============================================================
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Authentification requise');
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Accès réservé aux rôles : ${roles.join(', ')}`);
  }
  next();
};

// ============================================================
// Raccourcis de rôles
// ============================================================
const requireAdmin       = requireRole('ADMIN');
const requireSupplier    = requireRole('SUPPLIER', 'ADMIN');
const requireMember      = requireRole('MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN');
const requireGroupLeader = requireRole('GROUP_LEADER', 'SUPPLIER', 'ADMIN');

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireSupplier,
  requireMember,
  requireGroupLeader,
};