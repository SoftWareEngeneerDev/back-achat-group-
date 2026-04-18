// ============================================================
// AUTH MIDDLEWARE — Vérification JWT et contrôle des rôles
// Plateforme Achats Groupés — Burkina Faso
// ============================================================

const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { JWT_SECRET } = require('../config/env');
const { unauthorized, forbidden } = require('../utils/response');

// ──────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL : authenticate
// ──────────────────────────────────────────────────────────

/**
 * Vérifie le token JWT Bearer dans le header Authorization.
 * Charge l'utilisateur depuis la base et le place dans req.user.
 *
 * CORRECTION : Bloque aussi les comptes PENDING_VERIFICATION
 * (auparavant un token valide pouvait passer malgré un compte non vérifié).
 *
 * Usage : router.get('/protected', authenticate, handler)
 */
const authenticate = async (req, res, next) => {
  try {
    // ── Extraction du token ──────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Token d\'authentification manquant');
    }

    const token = authHeader.split(' ')[1];

    // ── Vérification de la signature JWT ────────────────────
    const decoded = jwt.verify(token, JWT_SECRET);

    // ── Chargement de l'utilisateur depuis la DB ─────────────
    // On recharge depuis la DB à chaque requête pour détecter
    // les changements de statut (ban, suspension) en temps réel
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        status: true,
        trustScore: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return unauthorized(res, 'Utilisateur introuvable');
    }

    // ── Vérification du statut du compte ────────────────────
    // CORRECTION : PENDING_VERIFICATION est maintenant bloqué
    if (user.status === 'PENDING_VERIFICATION') {
      return forbidden(res, 'Compte non vérifié. Vérifiez votre SMS.');
    }
    if (user.status === 'BANNED') {
      return forbidden(res, 'Compte banni définitivement');
    }
    if (user.status === 'SUSPENDED') {
      return forbidden(res, 'Compte temporairement suspendu');
    }

    // ── Injection de l'utilisateur dans la requête ───────────
    req.user = user;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token expiré. Veuillez rafraîchir votre session.');
    }
    if (err.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Token invalide');
    }
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// MIDDLEWARE OPTIONNEL : optionalAuth
// ──────────────────────────────────────────────────────────

/**
 * Tente de décoder le token JWT sans bloquer si absent ou invalide.
 * Utile pour les routes publiques qui affichent du contenu différent
 * selon que l'utilisateur est connecté ou non (ex: catalogue produits).
 *
 * Usage : router.get('/products', optionalAuth, handler)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ── Pas de token → on continue sans user ────────────────
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, status: true },
    });

    // ── Seulement les comptes actifs bénéficient du contexte user ─
    if (user && user.status === 'ACTIVE') {
      req.user = user;
    }

    next();
  } catch {
    // ── Token invalide/expiré → on continue sans user (pas d'erreur) ─
    next();
  }
};

// ──────────────────────────────────────────────────────────
// MIDDLEWARE DE RÔLE : requireRole
// ──────────────────────────────────────────────────────────

/**
 * Vérifie que l'utilisateur connecté possède l'un des rôles autorisés.
 * Doit être utilisé APRÈS authenticate.
 *
 * Usage : router.delete('/admin/user/:id', authenticate, requireRole('ADMIN'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return unauthorized(res, 'Authentification requise');
  }
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Accès réservé aux rôles : ${roles.join(', ')}`);
  }
  next();
};

// ──────────────────────────────────────────────────────────
// RACCOURCIS DE RÔLES PRÉDÉFINIS
// ──────────────────────────────────────────────────────────

/** Accès réservé aux administrateurs uniquement */
const requireAdmin = requireRole('ADMIN');

/** Accès réservé aux fournisseurs et admins */
const requireSupplier = requireRole('SUPPLIER', 'ADMIN');

/** Accès réservé aux membres connectés (tous rôles sauf VISITOR) */
const requireMember = requireRole('MEMBER', 'SUPPLIER', 'GROUP_LEADER', 'ADMIN');

/** Accès réservé aux leaders de groupe, fournisseurs et admins */
const requireGroupLeader = requireRole('GROUP_LEADER', 'SUPPLIER', 'ADMIN');

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireSupplier,
  requireMember,
  requireGroupLeader, // ← Ajout : utile pour la gestion des groupes
};