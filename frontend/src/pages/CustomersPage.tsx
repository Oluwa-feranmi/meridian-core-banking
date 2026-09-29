import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersApi } from '@/api/resources';
import { ApiClientError } from '@/api/client';
import type { Customer } from '@/types';
import { Alert } from '@/components/Alert';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateOnly } from '@/utils/format';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  dateOfBirth: '',
  city: '',
  country: '',
};

export function CustomersPage() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runSearch = useCallback((q: string) => {
    setSearchError(null);
    customersApi
      .search({ q: q || undefined, page: 1, pageSize: 50 })
      .then((res) => setCustomers(res.data))
      .catch(() => setSearchError('Could not load customers.'));
  }, []);

  useEffect(() => {
    runSearch('');
  }, [runSearch]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setFormSubmitError(null);
    setIsSubmitting(true);
    try {
      const created = await customersApi.create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phoneNumber: form.phoneNumber || undefined,
        dateOfBirth: form.dateOfBirth,
        city: form.city || undefined,
        country: form.country || undefined,
      });
      setSuccessMessage(`Customer "${created.data.first_name} ${created.data.last_name}" created.`);
      setForm(emptyForm);
      setShowForm(false);
      runSearch(query);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'VALIDATION_ERROR') {
        setFormErrors((err.details as Record<string, string[]>) ?? {});
      } else if (err instanceof ApiClientError) {
        setFormSubmitError(err.message);
      } else {
        setFormSubmitError('Could not create customer. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Search existing customers or onboard a new one.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm((s) => !s)} type="button">
          {showForm ? 'Cancel' : 'New customer'}
        </button>
      </div>

      {successMessage && <Alert kind="success">{successMessage}</Alert>}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card__header">
            <h2 className="card__title">Create customer</h2>
          </div>
          <div className="card__body">
            {formSubmitError && <Alert kind="error">{formSubmitError}</Alert>}
            <form onSubmit={handleCreateSubmit}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                  {formErrors.firstName && <span className="field-error">{formErrors.firstName[0]}</span>}
                </div>
                <div className="field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                  {formErrors.lastName && <span className="field-error">{formErrors.lastName[0]}</span>}
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  {formErrors.email && <span className="field-error">{formErrors.email[0]}</span>}
                </div>
                <div className="field">
                  <label htmlFor="phoneNumber">Phone number</label>
                  <input
                    id="phoneNumber"
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dateOfBirth">Date of birth</label>
                  <input
                    id="dateOfBirth"
                    type="date"
                    required
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  />
                  {formErrors.dateOfBirth && <span className="field-error">{formErrors.dateOfBirth[0]}</span>}
                </div>
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <span className="spinner" /> : 'Create customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <form className="row" onSubmit={handleSearchSubmit} style={{ flex: 1 }}>
            <input
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            <button className="btn btn--secondary btn--sm" type="submit">
              Search
            </button>
          </form>
        </div>
        {searchError && (
          <div className="card__body">
            <Alert kind="error">{searchError}</Alert>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Location</th>
              <th>Status</th>
              <th>Customer since</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <tr key={c.customer_id}>
                <td>
                  <Link to={`/customers/${c.customer_id}`}>
                    {c.first_name} {c.last_name}
                  </Link>
                </td>
                <td className="mono">{c.email}</td>
                <td>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>{formatDateOnly(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers?.length === 0 && <div className="table-empty">No customers match your search.</div>}
        {customers === null && <div className="table-empty">Loading…</div>}
      </div>
    </>
  );
}
