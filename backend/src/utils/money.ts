// Pure fixed-point decimal arithmetic for money, deliberately isolated
// from everything else in the application (no DB, no config, no
// framework imports). NUMERIC(19,4) columns come back from `pg` as
// strings specifically so precision is never silently lost by passing
// them through a JS `number` — this module works in integer
// "ten-thousandths" (bigint) internally to avoid floating point drift,
// converting back to a fixed-point decimal string at the boundary.
//
// Being framework-free is what lets tests/unit/moneyMath.test.ts import
// this directly with zero setup — no environment variables, no database,
// no mocking required. That's a deliberate design choice, not an
// accident: the more of the domain's core logic that can live in
// dependency-free modules like this one, the cheaper (and faster) the
// test suite stays as the codebase grows.

const SCALE = 10_000; // 4 decimal places, matching NUMERIC(19,4)

export function toScaledInt(decimalString: string): bigint {
  const [whole, frac = ''] = decimalString.split('.');
  const paddedFrac = (frac + '0000').slice(0, 4);
  return BigInt(whole) * BigInt(SCALE) + BigInt(paddedFrac || '0');
}

export function fromScaledInt(value: bigint): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / BigInt(SCALE);
  const frac = (abs % BigInt(SCALE)).toString().padStart(4, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}
