import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '@/utils/AppError';

interface ValidationTargets {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

/**
 * Validates and coerces `req.body` / `req.params` / `req.query` against
 * Zod schemas before a controller ever sees the request. Every mutating
 * endpoint in this API is wired through this middleware — controllers can
 * therefore trust that `req.body` already matches its expected shape and
 * skip re-validating it.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.body) req.body = targets.body.parse(req.body);
      if (targets.params) req.params = targets.params.parse(req.params) as typeof req.params;
      if (targets.query) req.query = targets.query.parse(req.query) as typeof req.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(AppError.validation(err.flatten().fieldErrors));
      }
      next(err);
    }
  };
}
