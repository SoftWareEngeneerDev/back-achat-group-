// ============================================================
// RESPONSE HELPERS — Réponses API standardisées
// Djula Market — Burkina Faso
// ============================================================

// ============================================================
// SUCCÈS
// ============================================================

/** 200 — Réponse générique */
const success = (res, data = null, message = 'OK', statusCode = 200, meta = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

/** 201 — Ressource créée */
const created = (res, data, message = 'Ressource créée avec succès') =>
  success(res, data, message, 201);

/** 204 — Suppression réussie (pas de body) */
const deleted = (res) => res.status(204).send();

/** 200 — Liste paginée */
const paginated = (res, data, page, limit, total, message = 'OK') =>
  success(res, data, message, 200, {
    page      : parseInt(page),
    limit     : parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
    hasNext   : parseInt(page) < Math.ceil(total / limit),
    hasPrev   : parseInt(page) > 1,
  });

// ============================================================
// ERREURS
// ============================================================

/** Erreur générique */
const error = (res, message, statusCode = 400, code = null, details = null) => {
  const response = { success: false, error: { message } };
  if (code)    response.error.code    = code;
  if (details) response.error.details = details;
  return res.status(statusCode).json(response);
};

/** 400 — Requête invalide */
const badRequest = (res, message = 'Requête invalide') =>
  error(res, message, 400, 'BAD_REQUEST');

/** 401 — Non authentifié */
const unauthorized = (res, message = 'Non authentifié') =>
  error(res, message, 401, 'UNAUTHORIZED');

/** 403 — Accès refusé */
const forbidden = (res, message = 'Accès refusé') =>
  error(res, message, 403, 'FORBIDDEN');

/** 404 — Ressource introuvable */
const notFound = (res, resource = 'Ressource') =>
  error(res, `${resource} introuvable`, 404, 'NOT_FOUND');

/** 409 — Conflit (doublon) */
const conflict = (res, message, code = 'CONFLICT') =>
  error(res, message, 409, code);

/** 422 — Erreur de validation */
const validationError = (res, details) =>
  error(res, 'Données invalides', 422, 'VALIDATION_ERROR', details);

/** 429 — Trop de requêtes */
const tooManyRequests = (res, message = 'Trop de requêtes. Réessayez plus tard.') =>
  error(res, message, 429, 'RATE_LIMIT');

/** 503 — Service indisponible */
const serviceUnavailable = (res, message = 'Service temporairement indisponible.') =>
  error(res, message, 503, 'SERVICE_UNAVAILABLE');

module.exports = {
  // Succès
  success,
  created,
  deleted,
  paginated,
  // Erreurs
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  tooManyRequests,
  serviceUnavailable,
};