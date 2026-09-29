import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config';
import { AppError } from '@/utils/AppError';

export type ApiRole = 'ADMIN' | 'TELLER' | 'VIEWER';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: ApiRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/** Requires a valid Bearer JWT; attaches the decoded principal to req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing or malformed Authorization header.'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret) as AuthenticatedUser;
    req.user = { userId: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token.'));
  }
}

/** Restricts a route to one or more roles. Must run after requireAuth. */
export function requireRole(...roles: ApiRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden(`This action requires one of the following roles: ${roles.join(', ')}.`));
    }
    next();
  };
}
