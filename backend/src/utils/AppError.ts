// A single, typed error class used everywhere in the service layer instead
// of throwing raw strings or generic Errors. Carries an HTTP status code
// and a machine-readable `code` so the error middleware and the frontend
// can both branch on it reliably, without parsing message text.
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(resource: string, id?: string): AppError {
    return new AppError(404, 'NOT_FOUND', id ? `${resource} '${id}' was not found.` : `${resource} was not found.`);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: unknown): AppError {
    return new AppError(422, 'VALIDATION_ERROR', 'One or more fields failed validation.', details);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static unauthorized(message = 'Authentication is required.'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static insufficientFunds(): AppError {
    return new AppError(422, 'INSUFFICIENT_FUNDS', 'The account does not have sufficient funds for this transaction.');
  }

  static internal(message = 'An unexpected error occurred.'): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
}
