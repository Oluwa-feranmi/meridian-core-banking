import { randomInt } from 'crypto';

// Generates a human-facing account number in the format MER-XXXXXXXXXX.
// This is intentionally separate from the account's internal UUID primary
// key: customers and tellers read/say/type this number, so it should be
// short, branded, and free of characters that are easy to transpose.
// Collision handling lives in the repository layer (unique constraint +
// retry), since true uniqueness can only be guaranteed by the database.
export function generateAccountNumber(): string {
  const digits = String(randomInt(0, 10_000_000_000)).padStart(10, '0');
  return `MER-${digits}`;
}
