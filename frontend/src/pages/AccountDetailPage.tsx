import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { accountsApi } from '@/api/resources';
import { ApiClientError } from '@/api/client';
import type { Account, Transaction } from '@/types';
import { Alert } from '@/components/Alert';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatMoney } from '@/utils/format';

type ActionMode = 'deposit' | 'withdraw' | 'transfer' | null;

const TYPE_LABEL: Record<Transaction['transaction_type'], string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
};

function isInbound(type: Transaction['transaction_type']): boolean {
  return type === 'DEPOSIT' || type === 'TRANSFER_IN';
}

export function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<ActionMode>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!accountId) return;
    setLoadError(null);
    Promise.all([accountsApi.getById(accountId), accountsApi.history(accountId, 1, 25)])
      .then(([accountRes, historyRes]) => {
        setAccount(accountRes.data);
        setTransactions(historyRes.data);
      })
      .catch(() => setLoadError('Could not load this account.'));
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  function resetActionForm() {
    setAmount('');
    setDescription('');
    setToAccountId('');
    setActionError(null);
  }

  function openMode(next: ActionMode) {
    setMode((current) => (current === next ? null : next));
    resetActionForm();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accountId || !mode) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'deposit') {
        await accountsApi.deposit(accountId, amount, description || undefined);
        setSuccessMessage(`Deposited ${formatMoney(amount)}.`);
      } else if (mode === 'withdraw') {
        await accountsApi.withdraw(accountId, amount, description || undefined);
        setSuccessMessage(`Withdrew ${formatMoney(amount)}.`);
      } else if (mode === 'transfer') {
        await accountsApi.transfer(accountId, toAccountId, amount, description || undefined);
        setSuccessMessage(`Transferred ${formatMoney(amount)} to ${toAccountId}.`);
      }
      setMode(null);
      resetActionForm();
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'The transaction could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadError) return <Alert kind="error">{loadError}</Alert>;
  if (!account) return <div className="table-empty">Loading…</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title mono">{account.account_number}</h1>
          <p className="page-subtitle">{account.account_type === 'CHECKING' ? 'Checking account' : 'Savings account'}</p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      {successMessage && <Alert kind="success">{successMessage}</Alert>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Current balance</div>
          <div className="stat-card__value">{formatMoney(account.balance, account.currency_code)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card__header">
          <h2 className="card__title">Move money</h2>
          <div className="row">
            <button className="btn btn--secondary btn--sm" onClick={() => openMode('deposit')} type="button">
              Deposit
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => openMode('withdraw')} type="button">
              Withdraw
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => openMode('transfer')} type="button">
              Transfer
            </button>
          </div>
        </div>

        {mode && (
          <div className="card__body">
            {actionError && <Alert kind="error">{actionError}</Alert>}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="amount">Amount</label>
                  <input
                    id="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                {mode === 'transfer' && (
                  <div className="field">
                    <label htmlFor="toAccountId">Destination account id</label>
                    <input
                      id="toAccountId"
                      required
                      placeholder="Destination account UUID"
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                    />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="description">Description (optional)</label>
                  <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <span className="spinner" /> : `Confirm ${mode}`}
                </button>
                <button className="btn btn--secondary" type="button" onClick={() => setMode(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__header">
          <h2 className="card__title">Transaction history</h2>
        </div>
        <div>
          {transactions?.length === 0 && <div className="table-empty">No transactions yet.</div>}
          {transactions?.map((t) => {
            const inbound = isInbound(t.transaction_type);
            return (
              <div key={t.transaction_id} className={`ledger-row ${inbound ? 'ledger-row--in' : 'ledger-row--out'}`}>
                <div className="ledger-row__type">{TYPE_LABEL[t.transaction_type]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ledger-row__desc">{t.description ?? '—'}</div>
                  <div className="ledger-row__meta">
                    {formatDate(t.created_at)} &middot; balance after: {formatMoney(t.balance_after)}
                  </div>
                </div>
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
