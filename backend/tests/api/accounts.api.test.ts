import request from 'supertest';
import { createApp } from '@/app';
import { truncateAllTables, closeTestPool } from '../setup/testDb';
import { seedApiUser } from './helpers';

const app = createApp();

async function loginAsAdmin() {
  const { username, password } = await seedApiUser('ADMIN');
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.data.token as string;
}

async function createCustomer(token: string) {
  const res = await request(app)
    .post('/api/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Mae',
      lastName: 'Jemison',
      email: `mae.jemison.${Date.now()}@example.com`,
      dateOfBirth: '1956-10-17',
    });
  return res.body.data.customer_id as string;
}

describe('/api/accounts (API, full lifecycle)', () => {
  let token: string;
  let customerId: string;

  beforeEach(async () => {
    await truncateAllTables();
    token = await loginAsAdmin();
    customerId = await createCustomer(token);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it('opens an account, deposits, withdraws, and reflects the correct final balance', async () => {
    const openRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '1000.00' });
    expect(openRes.status).toBe(201);
    const accountId = openRes.body.data.account_id;
    expect(openRes.body.data.balance).toBe('1000.0000');

    const depositRes = await request(app)
      .post(`/api/accounts/${accountId}/deposit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '250.50', description: 'Paycheck' });
    expect(depositRes.status).toBe(200);
    expect(depositRes.body.data.account.balance).toBe('1250.5000');

    const withdrawRes = await request(app)
      .post(`/api/accounts/${accountId}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '300.00' });
    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.data.account.balance).toBe('950.5000');

    const historyRes = await request(app)
      .get(`/api/accounts/${accountId}/transactions`)
      .set('Authorization', `Bearer ${token}`);
    expect(historyRes.status).toBe(200);
    // opening deposit + deposit + withdrawal = 3 ledger rows
    expect(historyRes.body.data).toHaveLength(3);
    // most recent first
    expect(historyRes.body.data[0].transaction_type).toBe('WITHDRAWAL');
  });

  it('returns 422 INSUFFICIENT_FUNDS for an over-limit withdrawal via HTTP', async () => {
    const openRes = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '20.00' });
    const accountId = openRes.body.data.account_id;

    const res = await request(app)
      .post(`/api/accounts/${accountId}/withdraw`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '999.00' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('transfers funds between two accounts end-to-end', async () => {
    const account1Res = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId, accountType: 'CHECKING', currencyCode: 'USD', openingDeposit: '500.00' });
    const account2Res = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId, accountType: 'SAVINGS', currencyCode: 'USD' });

    const fromId = account1Res.body.data.account_id;
    const toId = account2Res.body.data.account_id;

    const transferRes = await request(app)
      .post(`/api/accounts/${fromId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toAccountId: toId, amount: '150.00', description: 'Move to savings' });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.data.fromAccount.balance).toBe('350.0000');
    expect(transferRes.body.data.toAccount.balance).toBe('150.0000');

    const toHistoryRes = await request(app)
      .get(`/api/accounts/${toId}/transactions`)
      .set('Authorization', `Bearer ${token}`);
    expect(toHistoryRes.body.data[0].transaction_type).toBe('TRANSFER_IN');
  });

  it('rejects opening an account with a malformed body with 422, not a 500', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: 'not-a-uuid', accountType: 'INVALID_TYPE' });

    expect(res.status).toBe(422);
  });

  it('GET /api/accounts/:id returns 404 for an unknown account', async () => {
    const res = await request(app)
      .get('/api/accounts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
