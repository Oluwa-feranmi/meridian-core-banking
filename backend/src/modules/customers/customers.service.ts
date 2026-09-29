import { createHmac } from 'crypto';
import { AppError } from '@/utils/AppError';
import { childLogger } from '@/utils/logger';
import { config } from '@/config';
import { customersRepository } from '@/modules/customers/customers.repository';
import {
  CreateCustomerInput,
  SearchCustomersQuery,
  UpdateCustomerInput,
} from '@/modules/customers/customers.schemas';

const log = childLogger('customers-service');

// A government ID is never stored in plaintext (see db/migrations/001,
// column `national_id_hash`). HMAC-SHA256 with a server-side secret is
// used rather than a plain hash so the value cannot be brute-forced
// offline even though ID numbers have relatively low entropy.
function hashNationalId(nationalId: string): string {
  return createHmac('sha256', config.auth.jwtSecret).update(nationalId).digest('hex');
}

export const customersService = {
  async create(input: CreateCustomerInput) {
    const existing = await customersRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict(`A customer with email '${input.email}' already exists.`);
    }

    const customer = await customersRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      dateOfBirth: input.dateOfBirth,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      stateProvince: input.stateProvince,
      postalCode: input.postalCode,
      country: input.country,
      nationalIdHash: input.nationalId ? hashNationalId(input.nationalId) : undefined,
    });

    log.info({ customerId: customer.customer_id }, 'customer created');
    return customer;
  },

  async getById(customerId: string) {
    const customer = await customersRepository.findById(customerId);
    if (!customer) throw AppError.notFound('Customer', customerId);
    return customer;
  },

  async update(customerId: string, input: UpdateCustomerInput) {
    await this.getById(customerId); // 404s early if the customer doesn't exist

    if (input.email) {
      const existing = await customersRepository.findByEmail(input.email);
      if (existing && existing.customer_id !== customerId) {
        throw AppError.conflict(`A customer with email '${input.email}' already exists.`);
      }
    }

    const updated = await customersRepository.update(customerId, input);
    log.info({ customerId }, 'customer updated');
    return updated;
  },

  async search(params: SearchCustomersQuery) {
    return customersRepository.search(params);
  },
};
