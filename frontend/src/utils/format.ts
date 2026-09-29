export function formatMoney(amount: string, currencyCode = 'USD'): string {
  const value = Number(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatDateOnly(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`;
}
