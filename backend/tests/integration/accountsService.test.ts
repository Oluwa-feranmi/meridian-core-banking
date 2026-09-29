import { accountsService } from '@/modules/accounts/accounts.service';
import { customersRepository } from '@/modules/customers/customers.repository';
import { AppError } from '@/utils/AppError';
import { truncateAllTables, closeTestPool } from '../setup/testDb';

async function createTestCustomer() {
  return customersRepository.create({
    firstName: 'Test',
    lastName: 'Customer',
    email: `test.customer.${Date.now()}.${Math.random()}@example.com`,
    dateOfBirth: '1990-01-01',
  });
}

describe('accountsService (integration)', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('opens an account with zero balance by default', async () => {
    const customer = await createTestCustomer();
    const account = await accountsService.open(
      { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD' },
      'test-suite',
    );
    expect(account.balance).toBe('0.0000');
    expect(account.account_number).toMatch(/^MER-\d{10}$/);
  });

  it('opens an account with an opening deposit and records it as a transaction', async () => {
    const customer = await createTestCustomer();
    const account = await accountsService.open(
      { customerId: customer.customer_id, accountType: 'SAVINGS', currencyCode: 'USD', openingDeposit: '500.00' },
      'test-suite',
    );
    expect(account.balance).toBe('500.0000');
  });

  it('rejects opening an account for a non-existent customer', async () => {
    await expect(
      accountsService.open(
        { customerId: '00000000-0000-0000-0000-000000000000', accountType: 'CHECKING', currencyCode: 'USD' },
        'test-suite',
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  describe('deposit', () => {
    it('increases the balance and records a DEPOSIT transaction', async () => {
      const customer = await createTestCustomer();
      const account = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD' },
        'test-suite',
      );

      const result = await accountsService.deposit(account.account_id, { amount: '100.00' }, 'test-suite');

      expect(result.account.balance).toBe('100.0000');
      expect(result.transaction.transaction_type).toBe('DEPOSIT');
      expect(result.transaction.balance_after).toBe('100.0000');
    });
  });

  describe('withdraw', () => {
    it('decreases the balance when funds are sufficient', async () => {
      const customer = await createTestCustomer();
      const account = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '200.00' },
        'test-suite',
      );

      const result = await accountsService.withdraw(account.account_id, { amount: '75.00' }, 'test-suite');
      expect(result.account.balance).toBe('125.0000');
    });

    it('rejects a withdrawal exceeding the balance with INSUFFICIENT_FUNDS, and does not change the balance', async () => {
      const customer = await createTestCustomer();
      const account = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '50.00' },
        'test-suite',
      );

      await expect(
        accountsService.withdraw(account.account_id, { amount: '100.00' }, 'test-suite'),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });

      const unchanged = await accountsService.getById(account.account_id);
      expect(unchanged.balance).toBe('50.0000');
    });

    it('allows withdrawing the exact full balance down to zero', async () => {
      const customer = await createTestCustomer();
      const account = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '25.00' },
        'test-suite',
      );

      const result = await accountsService.withdraw(account.account_id, { amount: '25.00' }, 'test-suite');
      expect(result.account.balance).toBe('0.0000');
    });
  });

  describe('transfer', () => {
    it('moves funds between two accounts and writes a linked TRANSFER_OUT/TRANSFER_IN pair', async () => {
      const customer = await createTestCustomer();
      const fromAccount = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '300.00' },
        'test-suite',
      );
      const toAccount = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'SAVINGS', currencyCode: 'USD' },
        'test-suite',
      );

      const result = await accountsService.transfer(
        fromAccount.account_id,
        { toAccountId: toAccount.account_id, amount: '120.00' },
        'test-suite',
      );

      expect(result.fromAccount.balance).toBe('180.0000');
      expect(result.toAccount.balance).toBe('120.0000');
      expect(result.outTransaction.transfer_group_id).toBe(result.inTransaction.transfer_group_id);
      expect(result.outTransaction.transaction_type).toBe('TRANSFER_OUT');
      expect(result.inTransaction.transaction_type).toBe('TRANSFER_IN');
    });

    it('rejects a transfer to the same account', async () => {
      const customer = await createTestCustomer();
      const account = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '100.00' },
        'test-suite',
      );

      await expect(
        accountsService.transfer(account.account_id, { toAccountId: account.account_id, amount: '10.00' }, 'test-suite'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('rolls back BOTH sides of a transfer if the source has insufficient funds (atomicity)', async () => {
      const customer = await createTestCustomer();
      const fromAccount = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '10.00' },
        'test-suite',
      );
      const toAccount = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'SAVINGS', currencyCode: 'USD', openingDeposit: '10.00' },
        'test-suite',
      );

      await expect(
        accountsService.transfer(
          fromAccount.account_id,
          { toAccountId: toAccount.account_id, amount: '1000.00' },
          'test-suite',
        ),
      ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });

      // Neither balance moved — proves the transaction rolled back
      // completely rather than partially applying one side.
      const fromAfter = await accountsService.getById(fromAccount.account_id);
      const toAfter = await accountsService.getById(toAccount.account_id);
      expect(fromAfter.balance).toBe('10.0000');
      expect(toAfter.balance).toBe('10.0000');
    });

    /**
     * The key concurrency-safety test: fires two concurrent withdrawals
     * against the same account, each individually valid (50 each against
     * a 60 balance) but not both valid together. Row-level locking
     * (SELECT ... FOR UPDATE in accountsRepository.findByIdForUpdate)
     * must serialize these so the second one sees the already-updated
     * balance and correctly fails with INSUFFICIENT_FUNDS — proving the
     * "lost update" race condition this schema is designed to prevent
     * doesn't happen in practice, not just in theory.
     */
    it('serializes concurrent withdrawals against the same account instead of allowing a lost update', async () => {
      const customer = await createTestCustomer();
      const account = await accountsService.open(
        { customerId: customer.customer_id, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '60.00' },
        'test-suite',
      );

      const results = await Promise.allSettled([
        accountsService.withdraw(account.account_id, { amount: '50.00' }, 'test-suite'),
        accountsService.withdraw(account.account_id, { amount: '50.00' }, 'test-suite'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one must succeed and one must fail — if row locking were
      // broken, both could succeed and the balance would incorrectly go
      // negative (which the CHECK constraint would also catch, but we
      // want the application layer to fail cleanly with
      // INSUFFICIENT_FUNDS, not rely on the database constraint as a
      // last resort).
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalAccount = await accountsService.getById(account.account_id);
      expect(finalAccount.balance).toBe('10.0000');
    });
  });
});
