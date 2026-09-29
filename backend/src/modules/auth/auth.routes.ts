import { Router } from 'express';
import { validate } from '@/middleware/validate';
import { requireAuth } from '@/middleware/auth';
import { authController } from '@/modules/auth/auth.controller';
import { loginSchema } from '@/modules/auth/auth.schemas';

export const authRouter = Router();

authRouter.post('/login', validate({ body: loginSchema }), authController.login);
authRouter.get('/me', requireAuth, authController.me);
