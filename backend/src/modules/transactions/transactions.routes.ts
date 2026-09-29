import { RequestHandler, Router } from 'express';
import { validate } from '@/middleware/validate';
import { requireAuth } from '@/middleware/auth';
import { transactionsController } from '@/modules/transactions/transactions.controller';
import { recentTransactionsQuerySchema } from '@/modules/transactions/transactions.schemas';

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

transactionsRouter.get(
  '/recent',
  validate({ query: recentTransactionsQuerySchema }),
  transactionsController.recent as unknown as RequestHandler,
);
