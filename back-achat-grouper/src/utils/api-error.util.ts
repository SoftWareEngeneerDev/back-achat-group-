/**
 * Classe personnalisée pour les erreurs API
 */
export class ApiError extends Error {
  statusCode: number;
  errors?: any;

  constructor(statusCode: number, message: string, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'ApiError';

    // Maintenir la stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}
