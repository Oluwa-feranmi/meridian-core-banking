import { RequestHandler, Router } from 'express';
import { validate } from '@/middleware/validate';
import { requireAuth, requireRole } from '@/middleware/auth';
import { customersController } from '@/modules/customers/customers.controller';
import { accountsController } from '@/modules/accounts/accounts.controller';
import {
  createCustomerSchema,
  customerIdParamSchema,
  searchCustomersQuerySchema,
  updateCustomerSchema,
} from '@/modules/customers/customers.schemas';

export const customersRouter = Router();

customersRouter.use(requireAuth);

customersRouter.get('/', validate({ query: searchCustomersQuerySchema }), customersController.search as unknown as RequestHandler);

customersRouter.post(
  '/',
  requireRole('ADMIN', 'TELLER'),
  validate({ body: createCustomerSchema }),
  customersController.create,
);

customersRouter.get(
  '/:customerId',
  validate({ params: customerIdParamSchema }),
  customersController.getById,
);

customersRouter.patch(
  '/:customerId',
  requireRole('ADMIN', 'TELLER'),
  validate({ params: customerIdParamSchema, body: updateCustomerSchema }),
  customersController.update,
);

customersRouter.get(
  '/:customerId/accounts',
  validate({ params: customerIdParamSchema }),
  accountsController.listForCustomer,
);
