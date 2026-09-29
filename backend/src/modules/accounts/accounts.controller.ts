import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '@/middleware/errorHandler';
import { accountsService } from '@/modules/accounts/accounts.service';
import { transactionsRepository } from '@/modules/transactions/transactions.repository';
import {
  DepositInput,
  OpenAccountInput,
  SearchAccountsQuery,
  TransactionHistoryQuery,
  TransferInput,
  WithdrawInput,
} from '@/modules/accounts/accounts.schemas';

// req.user is guaranteed present because every route below sits behind
// requireAuth (see accounts.routes.ts); the `!` reflects that guarantee.
function actor(req: Request): string {
  return req.user!.username;
}

export const accountsController = {
  open: asyncHandler(async (req: Request<ParamsDictionary, unknown, OpenAccountInput>, res: Response) => {
    const account = await accountsService.open(req.body, actor(req));
    res.status(201).json({ data: account });
  }),

  getById: asyncHandler(async (req: Request<{ accountId: string }>, res: Response) => {
    const account = await accountsService.getById(req.params.accountId);
    res.status(200).json({ data: account });
  }),

  search: asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown, SearchAccountsQuery>, res: Response) => {
    const { rows, total } = await accountsService.search(req.query);
    res.status(200).json({ data: rows, pagination: { page: req.query.page, pageSize: req.query.pageSize, total } });
  }),

  listForCustomer: asyncHandler(async (req: Request<{ customerId: string }>, res: Response) => {
    const accounts = await accountsService.listByCustomer(req.params.customerId);
    res.status(200).json({ data: accounts });
  }),

  deposit: asyncHandler(async (req: Request<{ accountId: string }, unknown, DepositInput>, res: Response) => {
    const result = await accountsService.deposit(req.params.accountId, req.body, actor(req));
    res.status(200).json({ data: result });
  }),

  withdraw: asyncHandler(async (req: Request<{ accountId: string }, unknown, WithdrawInput>, res: Response) => {
    const result = await accountsService.withdraw(req.params.accountId, req.body, actor(req));
    res.status(200).json({ data: result });
  }),

  transfer: asyncHandler(async (req: Request<{ accountId: string }, unknown, TransferInput>, res: Response) => {
    const result = await accountsService.transfer(req.params.accountId, req.body, actor(req));
    res.status(200).json({ data: result });
  }),

  history: asyncHandler(
    async (req: Request<{ accountId: string }, unknown, unknown, TransactionHistoryQuery>, res: Response) => {
      // Confirms the account exists (404s otherwise) before paginating history.
      await accountsService.getById(req.params.accountId);
      const { rows, total } = await transactionsRepository.findByAccount(
        req.params.accountId,
        req.query.page,
        req.query.pageSize,
      );
      res.status(200).json({ data: rows, pagination: { page: req.query.page, pageSize: req.query.pageSize, total } });
    },
  ),
};
