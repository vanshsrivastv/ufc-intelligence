export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-12 flex flex-col items-center gap-3 py-12 text-center">
      <div className="h-6 w-6 rounded-full border border-text-muted" />
      <p className="text-body-md text-text-muted">{message}</p>
      {action}
    </div>
  );
}