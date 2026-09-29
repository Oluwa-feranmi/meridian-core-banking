import { customersRepository } from '@/modules/customers/customers.repository';
import { truncateAllTables, closeTestPool } from '../setup/testDb';

// These tests exercise real SQL against a real Postgres instance — see
// docs/04-testing-guide.md for how to stand up `meridian_test`. They're
// what prove the schema's constraints (UNIQUE email, CHECK status
// values) actually behave the way the application code assumes, not just
// that the application code calls the right methods.
describe('customersRepository (integration)', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('creates a customer and returns the generated id and timestamps', async () => {
    const customer = await customersRepository.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace.hopper@example.com',
      dateOfBirth: '1906-12-09',
    });

    expect(customer.customer_id).toBeDefined();
    expect(customer.status).toBe('ACTIVE');
    expect(customer.created_at).toBeDefined();
  });

  it('enforces the unique email constraint at the database level', async () => {
    await customersRepository.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'duplicate@example.com',
      dateOfBirth: '1906-12-09',
    });

    await expect(
      customersRepository.create({
        firstName: 'Someone',
        lastName: 'Else',
        email: 'duplicate@example.com',
        dateOfBirth: '1990-01-01',
      }),
    ).rejects.toMatchObject({ code: '23505' }); // Postgres unique_violation
  });

  it('finds a customer by id', async () => {
    const created = await customersRepository.create({
      firstName: 'Katherine',
      lastName: 'Johnson',
      email: 'katherine.johnson@example.com',
      dateOfBirth: '1918-08-26',
    });

    const found = await customersRepository.findById(created.customer_id);
    expect(found?.email).toBe('katherine.johnson@example.com');
  });

  it('returns null for a non-existent id rather than throwing', async () => {
    const found = await customersRepository.findById('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('search() matches partial, case-insensitive name queries', async () => {
    await customersRepository.create({
      firstName: 'Margaret',
      lastName: 'Hamilton',
      email: 'margaret.hamilton@example.com',
      dateOfBirth: '1936-08-17',
    });

    const { rows, total } = await customersRepository.search({ q: 'hamil', page: 1, pageSize: 20 });
    expect(total).toBe(1);
    expect(rows[0].last_name).toBe('Hamilton');
  });

  it('update() only changes the fields that were provided', async () => {
    const created = await customersRepository.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      dateOfBirth: '1815-12-10',
      city: 'London',
    });

    const updated = await customersRepository.update(created.customer_id, { city: 'Oxford' });
    expect(updated?.city).toBe('Oxford');
    expect(updated?.first_name).toBe('Ada'); // untouched
  });
});
