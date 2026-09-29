import request from 'supertest';
import { createApp } from '@/app';
import { truncateAllTables, closeTestPool } from '../setup/testDb';
import { seedApiUser } from './helpers';

const app = createApp();

async function loginAs(role: 'ADMIN' | 'TELLER' | 'VIEWER') {
  const { username, password } = await seedApiUser(role);
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.data.token as string;
}

describe('/api/customers (API)', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  it('creates a customer as a TELLER and returns 201 with the created record', async () => {
    const token = await loginAs('TELLER');

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Rosalind',
        lastName: 'Franklin',
        email: 'rosalind.franklin@example.com',
        dateOfBirth: '1920-07-25',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.customer_id).toBeDefined();
    expect(res.body.data.email).toBe('rosalind.franklin@example.com');
  });

  it('rejects customer creation from a VIEWER role with 403 (least-privilege enforcement)', async () => {
    const token = await loginAs('VIEWER');

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Rosalind',
        lastName: 'Franklin',
        email: 'rosalind.franklin@example.com',
        dateOfBirth: '1920-07-25',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 422 with field-level details for an invalid email', async () => {
    const token = await loginAs('ADMIN');

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Rosalind',
        lastName: 'Franklin',
        email: 'not-an-email',
        dateOfBirth: '1920-07-25',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.details.email).toBeDefined();
  });

  it('returns 409 when creating a customer with a duplicate email', async () => {
    const token = await loginAs('ADMIN');
    const payload = {
      firstName: 'Rosalind',
      lastName: 'Franklin',
      email: 'duplicate.api@example.com',
      dateOfBirth: '1920-07-25',
    };

    await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send(payload);
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send(payload);

    expect(res.status).toBe(409);
  });

  it('GET /api/customers/:id returns 404 for a non-existent customer', async () => {
    const token = await loginAs('ADMIN');

    const res = await request(app)
      .get('/api/customers/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/customers?q= finds a customer by partial name match', async () => {
    const token = await loginAs('ADMIN');
    await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({
      firstName: 'Chien-Shiung',
      lastName: 'Wu',
      email: 'chien-shiung.wu@example.com',
      dateOfBirth: '1912-05-31',
    });

    const res = await request(app).get('/api/customers').query({ q: 'chien' }).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });
});
