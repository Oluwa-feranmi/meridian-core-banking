import request from 'supertest';
import { createApp } from '@/app';
import { closeTestPool } from '../setup/testDb';

const app = createApp();

describe('/health (API)', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  it('GET /health/live returns 200 without touching the database', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready returns 200 with checks.database = up when the database is reachable', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('up');
  });

  it('health endpoints require no authentication', async () => {
    const liveRes = await request(app).get('/health/live');
    const readyRes = await request(app).get('/health/ready');
    expect(liveRes.status).not.toBe(401);
    expect(readyRes.status).not.toBe(401);
  });
});
