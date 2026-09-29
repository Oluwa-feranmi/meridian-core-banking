import { AppError } from '@/utils/AppError';

describe('AppError factories', () => {
  it('notFound() produces a 404 with the resource name in the message', () => {
    const err = AppError.notFound('Customer', 'abc-123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('Customer');
    expect(err.message).toContain('abc-123');
  });

  it('notFound() without an id still produces a sensible message', () => {
    const err = AppError.notFound('Account');
    expect(err.message).toBe('Account was not found.');
  });

  it('insufficientFunds() produces a 422 with a stable error code', () => {
    const err = AppError.insufficientFunds();
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('validation() carries field-level details through', () => {
    const details = { email: ['must be a valid email address'] };
    const err = AppError.validation(details);
    expect(err.statusCode).toBe(422);
    expect(err.details).toEqual(details);
  });

  it('unauthorized() defaults to a generic message that does not leak specifics', () => {
    const err = AppError.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication is required.');
  });

  it('is an instance of Error and carries a stack trace', () => {
    const err = AppError.internal();
    expect(err).toBeInstanceOf(Error);
    expect(err.stack).toBeDefined();
  });
});
