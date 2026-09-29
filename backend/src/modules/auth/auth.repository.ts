import { query } from '@/db/pool';
import { ApiRole } from '@/middleware/auth';

export interface ApiUserRecord {
  user_id: string;
  username: string;
  password_hash: string;
  role: ApiRole;
  is_active: boolean;
}

export const authRepository = {
  async findByUsername(username: string): Promise<ApiUserRecord | null> {
    const result = await query<ApiUserRecord>(
      `SELECT user_id, username, password_hash, role, is_active
       FROM api_users
       WHERE username = $1`,
      [username],
    );
    return result.rows[0] ?? null;
  },

  async touchLastLogin(userId: string): Promise<void> {
    await query(`UPDATE api_users SET last_login_at = now() WHERE user_id = $1`, [userId]);
  },
};
