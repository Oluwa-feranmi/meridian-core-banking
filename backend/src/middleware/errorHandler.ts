import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { AppError } from '@/utils/AppError';
import { childLogger } from '@/utils/logger';

const log = childLogger('error-handler');

// Postgres error codes we translate into meaningful HTTP responses instead
// of leaking a raw "duplicate key value violates unique constraint" string
// to the client.
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

interface PgError extends Error {
  code?: string;
  constraint?: string;
}

/**
 * Centralized error handler. Every route handler in this application
 * forwards errors here via `next(err)` (or async errors are caught by the
 * `asyncHandler` wrapper) rather than formatting error responses inline —
 * this guarantees a single, consistent error response shape across the
 * entire API.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = res.getHeader('X-Request-Id');

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      log.error({ err, requestId }, 'operational error (5xx)');
    } else {
      log.warn({ code: err.code, requestId, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? undefined,
        requestId,
      },
    });
    return;
  }

  const pgErr = err as PgError;
  if (pgErr.code === PG_UNIQUE_VIOLATION) {
    log.warn({ constraint: pgErr.constraint, requestId }, 'unique constraint violation');
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with this value already exists.', requestId },
    });
    return;
  }
  if (pgErr.code === PG_FOREIGN_KEY_VIOLATION) {
    log.warn({ constraint: pgErr.constraint, requestId }, 'foreign key violation');
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'This action references a record that does not exist.', requestId },
    });
    return;
  }
  if (pgErr.code === PG_CHECK_VIOLATION) {
    log.warn({ constraint: pgErr.constraint, requestId }, 'check constraint violation');
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'This action would violate a data integrity rule (e.g. a negative balance).', requestId },
    });
    return;
  }

  // Anything else is unexpected: log the full error (server-side only) and
  // return a generic message. Never leak stack traces or raw error
  // messages to the client in production.
  log.error({ err, requestId }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      requestId,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` },
  });
}

/**
 * Wraps an async route handler so rejected promises reach errorHandler.
 * Typed via Express's own `RequestHandler<P, ResBody, ReqBody, ReqQuery>`
 * (a method-style call signature, checked bivariantly) rather than a plain
 * function type, so route-specific params/body/query types declared by
 * each controller are actually assignable when passed to router.get/post.
 */
export function asyncHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
>(
  fn: (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody>, next: NextFunction) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
