import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountsApi } from '@/api/resources';
import type { Account } from '@/types';
import { Alert } from '@/components/Alert';
import { StatusBadge } from '@/components/StatusBadge';
import { formatMoney } from '@/utils/format';

export function AccountsPage() {
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback((q: string) => {
    setError(null);
    accountsApi
      .search({ q: q || undefined, page: 1, pageSize: 50 })
      .then((res) => setAccounts(res.data))
      .catch(() => setError('Could not load accounts.'));
  }, []);

  useEffect(() => {
    runSearch('');
  }, [runSearch]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Search by account number. Open new accounts from a customer's profile.</p>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <form className="row" onSubmit={handleSubmit} style={{ flex: 1 }}>
            <input
              placeholder="Search by account number, e.g. MER-000000…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <button className="btn btn--secondary btn--sm" type="submit">
              Search
            </button>
          </form>
        </div>
        {error && (
          <div className="card__body">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Account number</th>
              <th>Type</th>
              <th>Balance</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts?.map((a) => (
              <tr key={a.account_id}>
                <td className="mono">{a.account_number}</td>
                <td>{a.account_type === 'CHECKING' ? 'Checking' : 'Savings'}</td>
                <td className="mono">{formatMoney(a.balance, a.currency_code)}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>
                  <Link to={`/accounts/${a.account_id}`} className="btn btn--secondary btn--sm">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts?.length === 0 && <div className="table-empty">No accounts match your search.</div>}
        {accounts === null && <div className="table-empty">Loading…</div>}
      </div>
    </>
  );
}
