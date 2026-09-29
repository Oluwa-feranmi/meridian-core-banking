import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '@/middleware/errorHandler';
import { transactionsRepository } from '@/modules/transactions/transactions.repository';
import { RecentTransactionsQuery } from '@/modules/transactions/transactions.schemas';

export const transactionsController = {
  recent: asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown, RecentTransactionsQuery>, res: Response) => {
    const rows = await transactionsRepository.findRecent(req.query.limit);
    res.status(200).json({ data: rows });
  }),
};
