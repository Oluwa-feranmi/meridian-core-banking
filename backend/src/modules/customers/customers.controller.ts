import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '@/middleware/errorHandler';
import { customersService } from '@/modules/customers/customers.service';
import {
  CreateCustomerInput,
  SearchCustomersQuery,
  UpdateCustomerInput,
} from '@/modules/customers/customers.schemas';

export const customersController = {
  create: asyncHandler(async (req: Request<ParamsDictionary, unknown, CreateCustomerInput>, res: Response) => {
    const customer = await customersService.create(req.body);
    res.status(201).json({ data: customer });
  }),

  getById: asyncHandler(async (req: Request<{ customerId: string }>, res: Response) => {
    const customer = await customersService.getById(req.params.customerId);
    res.status(200).json({ data: customer });
  }),

  update: asyncHandler(
    async (req: Request<{ customerId: string }, unknown, UpdateCustomerInput>, res: Response) => {
      const customer = await customersService.update(req.params.customerId, req.body);
      res.status(200).json({ data: customer });
    },
  ),

  search: asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown, SearchCustomersQuery>, res: Response) => {
    const { rows, total } = await customersService.search(req.query);
    res.status(200).json({
      data: rows,
      pagination: { page: req.query.page, pageSize: req.query.pageSize, total },
    });
  }),
};
