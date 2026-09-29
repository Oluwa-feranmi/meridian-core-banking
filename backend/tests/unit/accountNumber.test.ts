import { generateAccountNumber } from '@/utils/accountNumber';

describe('generateAccountNumber', () => {
  it('produces the MER-XXXXXXXXXX format with exactly 10 digits', () => {
    const accountNumber = generateAccountNumber();
    expect(accountNumber).toMatch(/^MER-\d{10}$/);
  });

  it('produces different numbers across many calls (no obvious collision pattern)', () => {
    const generated = new Set(Array.from({ length: 500 }, () => generateAccountNumber()));
    // Not a proof of uniqueness (that's the DB constraint's job — see
    // db/migrations/001), but 500 calls colliding would indicate a
    // seriously broken RNG usage, not bad luck.
    expect(generated.size).toBe(500);
  });
});
