import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { accountsApi, customersApi } from '@/api/resources';
import { ApiClientError } from '@/api/client';
import type { Account, Customer } from '@/types';
import { Alert } from '@/components/Alert';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateOnly, formatMoney } from '@/utils/format';

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [accountType, setAccountType] = useState<'CHECKING' | 'SAVINGS'>('CHECKING');
  const [openingDeposit, setOpeningDeposit] = useState('');
  const [openError, setOpenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!customerId) return;
    setLoadError(null);
    Promise.all([customersApi.getById(customerId), customersApi.listAccounts(customerId)])
      .then(([customerRes, accountsRes]) => {
        setCustomer(customerRes.data);
        setAccounts(accountsRes.data);
      })
      .catch(() => setLoadError('Could not load this customer.'));
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpenAccount(e: FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    setOpenError(null);
    setIsSubmitting(true);
    try {
      await accountsApi.open({
        customerId,
        accountType,
        openingDeposit: openingDeposit || undefined,
      });
      setSuccessMessage(`New ${accountType.toLowerCase()} account opened.`);
      setShowOpenForm(false);
      setOpeningDeposit('');
      load();
    } catch (err) {
      setOpenError(err instanceof ApiClientError ? err.message : 'Could not open account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) return <Alert kind="error">{loadError}</Alert>;
  if (!customer) return <div className="table-empty">Loading…</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {customer.first_name} {customer.last_name}
          </h1>
          <p className="page-subtitle">
            {customer.email} &middot; Customer since {formatDateOnly(customer.created_at)}
          </p>
        </div>
        <StatusBadge status={customer.status} />
      </div>

      {successMessage && <Alert kind="success">{successMessage}</Alert>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Phone</div>
          <div className="stat-card__value" style={{ fontSize: 15 }}>
            {customer.phone_number ?? '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Location</div>
          <div className="stat-card__value" style={{ fontSize: 15 }}>
            {[customer.city, customer.country].filter(Boolean).join(', ') || '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Accounts</div>
          <div className="stat-card__value">{accounts?.length ?? '—'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Accounts</h2>
          <button className="btn btn--primary btn--sm" onClick={() => setShowOpenForm((s) => !s)} type="button">
            {showOpenForm ? 'Cancel' : 'Open account'}
          </button>
        </div>

        {showOpenForm && (
          <div className="card__body" style={{ borderBottom: '1px solid var(--border)' }}>
            {openError && <Alert kind="error">{openError}</Alert>}
            <form onSubmit={handleOpenAccount}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="accountType">Account type</label>
                  <select
                    id="accountType"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as 'CHECKING' | 'SAVINGS')}
                  >
                    <option value="CHECKING">Checking</option>
                    <option value="SAVINGS">Savings</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="openingDeposit">Opening deposit (optional)</label>
                  <input
                    id="openingDeposit"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={openingDeposit}
                    onChange={(e) => setOpeningDeposit(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <span className="spinner" /> : 'Open account'}
                </button>
              </div>
            </form>
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
        {accounts?.length === 0 && <div className="table-empty">No accounts yet for this customer.</div>}
      </div>
    </>
  );
}
