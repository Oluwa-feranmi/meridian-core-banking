import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '@/config';
import { AppError } from '@/utils/AppError';
import { childLogger } from '@/utils/logger';
import { authRepository } from '@/modules/auth/auth.repository';
import { LoginInput } from '@/modules/auth/auth.schemas';

const log = childLogger('auth-service');

export interface LoginResult {
  token: string;
  expiresIn: string;
  user: { userId: string; username: string; role: string };
}

export const authService = {
  async login(input: LoginInput): Promise<LoginResult> {
    try {
      log.debug({ username: input.username }, 'login attempt started');
      const record = await authRepository.findByUsername(input.username);
      log.debug({ username: input.username, recordFound: !!record }, 'user lookup completed');

      // Deliberately identical error for "user not found" and "wrong
      // password" — distinguishing them lets an attacker enumerate valid
      // usernames.
      if (!record || !record.is_active) {
        log.warn({ username: input.username }, 'login attempt for unknown or inactive user');
        throw AppError.unauthorized('Invalid username or password.');
      }

      const passwordMatches = await bcrypt.compare(input.password, record.password_hash);
      log.debug({ username: input.username, passwordMatches }, 'password comparison completed');
      if (!passwordMatches) {
        log.warn({ username: input.username }, 'login attempt with incorrect password');
        throw AppError.unauthorized('Invalid username or password.');
      }

      const token = jwt.sign(
        { userId: record.user_id, username: record.username, role: record.role },
        config.auth.jwtSecret,
        { expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'] },
      );

      await authRepository.touchLastLogin(record.user_id);
      log.info({ username: record.username, role: record.role }, 'login succeeded');

      return {
        token,
        expiresIn: config.auth.jwtExpiresIn,
        user: { userId: record.user_id, username: record.username, role: record.role },
      };
    } catch (err) {
      log.error({ err, username: input.username }, 'login error');
      throw err;
    }
  },
};
