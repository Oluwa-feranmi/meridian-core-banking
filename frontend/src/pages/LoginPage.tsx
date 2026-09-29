import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiClientError } from '@/api/client';
import { Alert } from '@/components/Alert';

export function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__brand">
          <span className="login-card__brand-mark" aria-hidden="true" />
          <strong>Meridian</strong>
        </div>
        <h1 className="login-card__title">Sign in to the console</h1>

        {error && <Alert kind="error">{error}</Alert>}

        <form className="stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <span className="spinner" /> : 'Sign in'}
          </button>
        </form>

        <div className="login-card__hint">
          Seed data: <span className="mono">admin</span> / <span className="mono">ChangeMe123!</span>
        </div>
      </div>
    </div>
  );
}
