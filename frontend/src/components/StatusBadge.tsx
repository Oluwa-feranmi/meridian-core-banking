interface StatusBadgeProps {
  status: string;
}

const TONE_BY_STATUS: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  ACTIVE: 'positive',
  COMPLETED: 'positive',
  CLOSED: 'neutral',
  SUSPENDED: 'warning',
  FROZEN: 'warning',
  PENDING: 'warning',
  FAILED: 'negative',
  REVERSED: 'negative',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = TONE_BY_STATUS[status] ?? 'neutral';
  return <span className={`badge badge--${tone}`}>{status.toLowerCase()}</span>;
}
