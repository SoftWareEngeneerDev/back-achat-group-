/**
 * Formateur de réponses API standardisées
 */

const success = (res, data = null, message = 'OK', statusCode = 200, meta = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return res.status(statusCode).json(response);
};

const created = (res, data, message = 'Ressource créée avec succès') =>
  success(res, data, message, 201);

const paginated = (res, data, page, limit, total) =>
  success(res, data, 'OK', 200, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit),
  });

const error = (res, message, statusCode = 400, code = null, details = null) => {
  const response = { success: false, error: { message } };
  if (code) response.error.code = code;
  if (details) response.error.details = details;
  return res.status(statusCode).json(response);
};

const notFound = (res, resource = 'Ressource') =>
  error(res, `${resource} introuvable`, 404, 'NOT_FOUND');

const unauthorized = (res, message = 'Non authentifié') =>
  error(res, message, 401, 'UNAUTHORIZED');

const forbidden = (res, message = 'Accès refusé') =>
  error(res, message, 403, 'FORBIDDEN');

const conflict = (res, message, code = 'CONFLICT') =>
  error(res, message, 409, code);

const validationError = (res, details) =>
  error(res, 'Données invalides', 422, 'VALIDATION_ERROR', details);

module.exports = { success, created, paginated, error, notFound, unauthorized, forbidden, conflict, validationError };
