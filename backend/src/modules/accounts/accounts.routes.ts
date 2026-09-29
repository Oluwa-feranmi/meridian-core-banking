import { RequestHandler, Router } from 'express';
import { validate } from '@/middleware/validate';
import { requireAuth, requireRole } from '@/middleware/auth';
import { accountsController } from '@/modules/accounts/accounts.controller';
import {
  accountIdParamSchema,
  depositSchema,
  openAccountSchema,
  searchAccountsQuerySchema,
  transferSchema,
  withdrawSchema,
} from '@/modules/accounts/accounts.schemas';
import { transactionHistoryQuerySchema } from '@/modules/accounts/accounts.schemas';

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

// NOTE on the `as RequestHandler` casts below: Express's router overloads
// require every handler in a chain to share one set of Params/Body/Query
// generics, inferred from the first handler (here, `validate`, which is
// intentionally untyped since it works generically across all routes).
// The controller handler has a more specific, correct query type from its
// Zod schema; the cast tells TypeScript to trust that — validated at
// runtime by Zod — rather than trying to thread bespoke generics through
// the validation middleware.
accountsRouter.get(
  '/',
  validate({ query: searchAccountsQuerySchema }),
  accountsController.search as unknown as RequestHandler,
);

accountsRouter.post(
  '/',
  requireRole('ADMIN', 'TELLER'),
  validate({ body: openAccountSchema }),
  accountsController.open,
);

accountsRouter.get('/:accountId', validate({ params: accountIdParamSchema }), accountsController.getById);

accountsRouter.get(
  '/:accountId/transactions',
  validate({ params: accountIdParamSchema, query: transactionHistoryQuerySchema }),
  accountsController.history as unknown as RequestHandler,
);

accountsRouter.post(
  '/:accountId/deposit',
  requireRole('ADMIN', 'TELLER'),
  validate({ params: accountIdParamSchema, body: depositSchema }),
  accountsController.deposit,
);

accountsRouter.post(
  '/:accountId/withdraw',
  requireRole('ADMIN', 'TELLER'),
  validate({ params: accountIdParamSchema, body: withdrawSchema }),
  accountsController.withdraw,
);

accountsRouter.post(
  '/:accountId/transfer',
  requireRole('ADMIN', 'TELLER'),
  validate({ params: accountIdParamSchema, body: transferSchema }),
  accountsController.transfer,
);
