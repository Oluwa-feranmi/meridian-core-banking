import { depositSchema } from '@/modules/accounts/accounts.schemas';
import { createCustomerSchema } from '@/modules/customers/customers.schemas';

describe('depositSchema (money amount validation)', () => {
  it('accepts a valid positive decimal amount', () => {
    const result = depositSchema.safeParse({ amount: '100.50' });
    expect(result.success).toBe(true);
  });

  it('accepts up to 4 decimal places', () => {
    expect(depositSchema.safeParse({ amount: '10.1234' }).success).toBe(true);
  });

  it('rejects more than 4 decimal places', () => {
    expect(depositSchema.safeParse({ amount: '10.12345' }).success).toBe(false);
  });

  it('rejects zero', () => {
    expect(depositSchema.safeParse({ amount: '0.00' }).success).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(depositSchema.safeParse({ amount: '-5.00' }).success).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(depositSchema.safeParse({ amount: 'abc' }).success).toBe(false);
  });

  it('rejects a bare JS number instead of a string (prevents float precision loss in transit)', () => {
    expect(depositSchema.safeParse({ amount: 100.5 }).success).toBe(false);
  });
});

describe('createCustomerSchema (date of birth validation)', () => {
  const baseInput = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    dateOfBirth: '1990-01-01',
  };

  it('accepts a valid past date', () => {
    expect(createCustomerSchema.safeParse(baseInput).success).toBe(true);
  });

  it('rejects a date of birth in the future', () => {
    const futureYear = new Date().getFullYear() + 1;
    const result = createCustomerSchema.safeParse({ ...baseInput, dateOfBirth: `${futureYear}-01-01` });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed date string', () => {
    const result = createCustomerSchema.safeParse({ ...baseInput, dateOfBirth: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('lowercases and trims email', () => {
    const result = createCustomerSchema.safeParse({ ...baseInput, email: '  ADA@EXAMPLE.COM  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('ada@example.com');
  });

  it('rejects a missing required field', () => {
    const { firstName, ...withoutFirstName } = baseInput;
    void firstName;
    expect(createCustomerSchema.safeParse(withoutFirstName).success).toBe(false);
  });
});
