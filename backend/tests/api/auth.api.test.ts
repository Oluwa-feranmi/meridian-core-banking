import request from 'supertest';
import { createApp } from '@/app';
import { truncateAllTables, closeTestPool } from '../setup/testDb';
import { seedApiUser } from './helpers';

const app = createApp();

describe('POST /api/auth/login (API)', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('returns a token for valid credentials', async () => {
    const { username, password } = await seedApiUser('ADMIN');

    const res = await request(app).post('/api/auth/login').send({ username, password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.username).toBe(username);
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('rejects an incorrect password with 401 and does not leak which part was wrong', async () => {
    const { username } = await seedApiUser('TELLER');

    const res = await request(app).post('/api/auth/login').send({ username, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a non-existent username with the same generic message as a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'irrelevant' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid username or password.');
  });

  it('returns a validation error for a missing password field', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'someone' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/auth/me returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns the authenticated principal with a valid token', async () => {
    const { username, password } = await seedApiUser('VIEWER');
    const loginRes = await request(app).post('/api/auth/login').send({ username, password });
    const token = loginRes.body.data.token;

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.username).toBe(username);
  });
});
