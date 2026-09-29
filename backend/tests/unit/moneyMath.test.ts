import { fromScaledInt, toScaledInt } from '@/utils/money';

// These are the most important unit tests in the whole codebase: money
// math is where floating-point bugs hide, and this schema stores balances
// as NUMERIC(19,4) precisely to avoid them. These tests exist to prove
// the scaled-bigint conversion round-trips exactly, including the cases
// that would silently break with plain JS `number` arithmetic.
//
// Note this module is imported directly from `@/utils/money`, not via
// accounts.service — that module is deliberately dependency-free (no DB,
// no config) so these tests need no environment setup at all.
describe('accounts money math (toScaledInt / fromScaledInt)', () => {
  it('round-trips a whole number amount', () => {
    expect(fromScaledInt(toScaledInt('100.0000'))).toBe('100.0000');
  });

  it('round-trips a fractional amount to 4 decimal places', () => {
    expect(fromScaledInt(toScaledInt('42.1234'))).toBe('42.1234');
  });

  it('round-trips zero', () => {
    expect(fromScaledInt(toScaledInt('0.0000'))).toBe('0.0000');
  });

  it('handles values with fewer than 4 decimal places by padding', () => {
    expect(toScaledInt('10.5').toString()).toBe('105000');
    expect(toScaledInt('10').toString()).toBe('100000');
  });

  it('adds two amounts without floating point drift', () => {
    // 0.1 + 0.2 famously != 0.3 in IEEE-754 floating point. This is
    // exactly the class of bug NUMERIC + bigint scaling avoids.
    const sum = toScaledInt('0.1000') + toScaledInt('0.2000');
    expect(fromScaledInt(sum)).toBe('0.3000');
  });

  it('subtracts correctly, including down to zero', () => {
    const result = toScaledInt('50.0000') - toScaledInt('50.0000');
    expect(fromScaledInt(result)).toBe('0.0000');
  });

  it('handles large balances without precision loss', () => {
    const large = '9999999999.9999';
    expect(fromScaledInt(toScaledInt(large))).toBe(large);
  });
});
