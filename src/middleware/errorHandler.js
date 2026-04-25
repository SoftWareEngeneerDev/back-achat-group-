// ============================================================
// ERROR HANDLER — Gestion centralisée des erreurs
// Djula Market — Burkina Faso
// ============================================================

const logger = require('../utils/logger');

// ── Codes d'erreur Prisma les plus fréquents ─────────────────
const PRISMA_ERRORS = {
  P2002: { status: 409, code: 'CONFLICT',            message: 'Cette ressource existe déjà.' },
  P2025: { status: 404, code: 'NOT_FOUND',           message: 'Ressource introuvable.' },
  P2003: { status: 400, code: 'FOREIGN_KEY_FAILED',  message: 'Référence invalide.' },
  P2014: { status: 400, code: 'RELATION_VIOLATION',  message: 'Violation de relation.' },
  P2016: { status: 400, code: 'QUERY_ERROR',         message: 'Erreur dans la requête.' },
  P2021: { status: 500, code: 'TABLE_NOT_FOUND',     message: 'Table introuvable — vérifiez les migrations.' },
  P2022: { status: 500, code: 'COLUMN_NOT_FOUND',    message: 'Colonne introuvable — vérifiez les migrations.' },
};

// ============================================================
// errorHandler — Middleware global d'erreurs Express
// ============================================================
const errorHandler = (err, req, res, next) => {
  // Log complet en dev, minimal en prod
  logger.error(`[${req.method}] ${req.url} — ${err.message}`, {
    stack  : err.stack,
    code   : err.code,
    status : err.status,
  });

  // ── Erreurs Prisma ─────────────────────────────────────────
  if (err.code && PRISMA_ERRORS[err.code]) {
    const { status, code, message } = PRISMA_ERRORS[err.code];
    return res.status(status).json({ success: false, error: { code, message } });
  }

  // ── Erreur de connexion Prisma ─────────────────────────────
  if (err.code === 'P1001' || err.code === 'P1002') {
    return res.status(503).json({
      success: false,
      error  : { code: 'DB_UNAVAILABLE', message: 'Base de données indisponible.' },
    });
  }

  // ── Erreurs JWT (si non catchées dans le middleware auth) ──
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error  : { code: 'INVALID_TOKEN', message: 'Token invalide.' },
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error  : { code: 'TOKEN_EXPIRED', message: 'Session expirée.' },
    });
  }

  // ── Erreur de validation (express-validator passé manuellement) ─
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error  : { code: 'VALIDATION_ERROR', message: err.message },
    });
  }

  // ── Erreur Multer (upload fichier) ─────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error  : { code: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux (max 5 MB).' },
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error  : { code: 'UNEXPECTED_FILE', message: 'Champ de fichier inattendu.' },
    });
  }

  // ── Erreur générique ───────────────────────────────────────
  const status  = err.status || err.statusCode || 500;
  const isProd  = process.env.NODE_ENV === 'production';
  const message = isProd && status === 500
    ? 'Erreur interne du serveur.'
    : err.message || 'Erreur interne du serveur.';

  res.status(status).json({
    success: false,
    error  : {
      code   : err.code || 'INTERNAL_ERROR',
      message,
    },
  });
};

// ============================================================
// notFoundHandler — Route introuvable
// ============================================================
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error  : {
      code   : 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} introuvable.`,
    },
  });
};

module.exports = { errorHandler, notFoundHandler };