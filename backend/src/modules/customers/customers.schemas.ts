import { z } from 'zod';

const nameField = z.string().trim().min(1, 'is required').max(100);

export const createCustomerSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: z.string().trim().toLowerCase().email('must be a valid email address'),
  phoneNumber: z.string().trim().max(20).optional(),
  dateOfBirth: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date (YYYY-MM-DD)')
    .refine((v) => new Date(v) < new Date(), 'must be in the past'),
  addressLine1: z.string().trim().max(255).optional(),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  stateProvince: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  nationalId: z.string().trim().min(1).max(64).optional(), // hashed before storage, see service
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerIdParamSchema = z.object({
  customerId: z.string().uuid('must be a valid customer id'),
});

export const searchCustomersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SearchCustomersQuery = z.infer<typeof searchCustomersQuerySchema>;
