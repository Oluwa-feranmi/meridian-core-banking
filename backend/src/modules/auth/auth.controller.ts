import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '@/middleware/errorHandler';
import { authService } from '@/modules/auth/auth.service';
import { LoginInput } from '@/modules/auth/auth.schemas';

export const authController = {
  login: asyncHandler(async (req: Request<ParamsDictionary, unknown, LoginInput>, res: Response) => {
    const result = await authService.login(req.body);
    res.status(200).json({ data: result });
  }),

  // Returns the currently authenticated principal — used by the frontend
  // on page load to decide whether a stored token is still valid.
  me: asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({ data: req.user });
  }),
};
