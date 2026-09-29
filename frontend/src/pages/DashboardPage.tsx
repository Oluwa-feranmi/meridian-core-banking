import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transactionsApi } from '@/api/resources';
import type { Transaction } from '@/types';
import { formatDate, formatMoney } from '@/utils/format';
import { Alert } from '@/components/Alert';

const TYPE_LABEL: Record<Transaction['transaction_type'], string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
};

function isInbound(type: Transaction['transaction_type']): boolean {
  return type === 'DEPOSIT' || type === 'TRANSFER_IN';
}

export function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    transactionsApi
      .recent(25)
      .then((res) => setTransactions(res.data))
      .catch(() => setError('Could not load recent transactions.'));
  }, []);

  const totalVolume = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
  const failedCount = transactions?.filter((t) => t.status === 'FAILED').length ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Live ledger activity across all Meridian accounts.</p>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Transactions shown</div>
          <div className="stat-card__value">{transactions?.length ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Volume (shown window)</div>
          <div className="stat-card__value">{formatMoney(String(totalVolume))}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Failed transactions</div>
          <div className="stat-card__value">{failedCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Recent activity</h2>
          <Link to="/accounts" className="btn btn--secondary btn--sm">
            Browse accounts
          </Link>
        </div>
        <div>
          {transactions === null && <div className="table-empty">Loading…</div>}
          {transactions?.length === 0 && <div className="table-empty">No transactions yet.</div>}
          {transactions?.map((t) => {
            const inbound = isInbound(t.transaction_type);
            return (
              <div key={t.transaction_id} className={`ledger-row ${inbound ? 'ledger-row--in' : 'ledger-row--out'}`}>
                <div className="ledger-row__type">{TYPE_LABEL[t.transaction_type]}</div>
                <div>
                  <div className="ledger-row__desc">{t.description ?? '—'}</div>
                  <div className="ledger-row__meta">{formatDate(t.created_at)}</div>
                </div>
                <div style={{ flex: 1 }} />
                <div className={`ledger-row__amount ledger-row__amount--${inbound ? 'in' : 'out'}`}>
                  {inbound ? '+' : '−'}
                  {formatMoney(t.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
