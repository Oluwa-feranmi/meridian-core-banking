import { PoolClient } from 'pg';
import { pool, query } from '@/db/pool';
import { SearchCustomersQuery } from '@/modules/customers/customers.schemas';

export interface CustomerRecord {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  date_of_birth: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  created_at: string;
  updated_at: string;
}

interface CreateCustomerParams {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  nationalIdHash?: string;
}

export const customersRepository = {
  async create(params: CreateCustomerParams, client: PoolClient = pool as unknown as PoolClient): Promise<CustomerRecord> {
    const result = await client.query<CustomerRecord>(
      `INSERT INTO customers
         (first_name, last_name, email, phone_number, date_of_birth,
          address_line1, address_line2, city, state_province, postal_code,
          country, national_id_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        params.firstName,
        params.lastName,
        params.email,
        params.phoneNumber ?? null,
        params.dateOfBirth,
        params.addressLine1 ?? null,
        params.addressLine2 ?? null,
        params.city ?? null,
        params.stateProvince ?? null,
        params.postalCode ?? null,
        params.country ?? null,
        params.nationalIdHash ?? null,
      ],
    );
    return result.rows[0];
  },

  async findById(customerId: string): Promise<CustomerRecord | null> {
    const result = await query<CustomerRecord>(`SELECT * FROM customers WHERE customer_id = $1`, [customerId]);
    return result.rows[0] ?? null;
  },

  async findByEmail(email: string): Promise<CustomerRecord | null> {
    const result = await query<CustomerRecord>(`SELECT * FROM customers WHERE email = $1`, [email]);
    return result.rows[0] ?? null;
  },

  async update(customerId: string, fields: Partial<CreateCustomerParams> & { status?: string }): Promise<CustomerRecord | null> {
    const columnMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phoneNumber: 'phone_number',
      dateOfBirth: 'date_of_birth',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      stateProvince: 'state_province',
      postalCode: 'postal_code',
      country: 'country',
      status: 'status',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || !(key in columnMap)) continue;
      setClauses.push(`${columnMap[key]} = $${i}`);
      values.push(value);
      i += 1;
    }

    if (setClauses.length === 0) {
      return this.findById(customerId);
    }

    values.push(customerId);
    const result = await query<CustomerRecord>(
      `UPDATE customers SET ${setClauses.join(', ')} WHERE customer_id = $${i} RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  },

  /**
   * Search by partial, case-insensitive name/email match plus optional
   * status filter, paginated. Backs both the "search customers" UI box
   * and any future reporting use of the same endpoint.
   */
  async search(params: SearchCustomersQuery): Promise<{ rows: CustomerRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (params.q) {
      conditions.push(
        `(lower(first_name) LIKE $${i} OR lower(last_name) LIKE $${i} OR lower(email) LIKE $${i})`,
      );
      values.push(`%${params.q.toLowerCase()}%`);
      i += 1;
    }
    if (params.status) {
      conditions.push(`status = $${i}`);
      values.push(params.status);
      i += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (params.page - 1) * params.pageSize;

    const [rowsResult, countResult] = await Promise.all([
      query<CustomerRecord>(
        `SELECT * FROM customers ${whereClause} ORDER BY last_name, first_name LIMIT $${i} OFFSET $${i + 1}`,
        [...values, params.pageSize, offset],
      ),
      query<{ count: string }>(`SELECT COUNT(*) FROM customers ${whereClause}`, values),
    ]);

    return { rows: rowsResult.rows, total: Number(countResult.rows[0].count) };
  },
};
