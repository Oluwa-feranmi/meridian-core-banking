interface AlertProps {
  kind: 'success' | 'error';
  children: React.ReactNode;
}

export function Alert({ kind, children }: AlertProps) {
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
