import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }): JSX.Element {
  return (
    <span
      className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600', className)}
      role="status"
      aria-label="Loading"
    />
  );
}
