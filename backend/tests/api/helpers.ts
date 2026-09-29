import bcrypt from 'bcrypt';
import { testPool } from '../setup/testDb';

/**
 * API tests need a real, authenticated request the same way a real
 * client would — so this creates a genuine api_users row (bcrypt-hashed
 * password, exactly like production) and returns credentials to log in
 * with via POST /api/auth/login, rather than minting a JWT directly and
 * skipping the auth flow under test.
 */
export async function seedApiUser(role: 'ADMIN' | 'TELLER' | 'VIEWER' = 'ADMIN') {
  const username = `test_${role.toLowerCase()}_${Date.now()}`;
  const password = 'Test-Password-123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await testPool.query(`INSERT INTO api_users (username, password_hash, role) VALUES ($1, $2, $3)`, [
    username,
    passwordHash,
    role,
  ]);

  return { username, password };
}
