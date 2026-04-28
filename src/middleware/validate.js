// ============================================================
// VALIDATE MIDDLEWARE — Validation des entrées express-validator
// Djula Market — Burkina Faso
// ============================================================

const { validationResult } = require('express-validator');
const { validationError }  = require('../utils/response');

// ============================================================
// validate — Vérifie les erreurs de validation et les retourne
// ============================================================
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map(e => ({
      field  : e.path ?? e.param, // compatibilité express-validator v6 et v7
      message: e.msg,
    }));
    return validationError(res, errors);
  }
  next();
};

// ============================================================
// sanitize — Nettoie les strings (trim + lowercase optionnel)
// Utile pour éviter les espaces parasites dans les champs texte
// ============================================================
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
};

module.exports = { validate, sanitizeBody };