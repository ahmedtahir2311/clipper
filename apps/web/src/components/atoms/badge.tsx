import { cn } from '@/lib/utils';
import type { JobStatus } from '@clipper/shared';

const STATUS_STYLES: Record<JobStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: JobStatus }): JSX.Element {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[status])}>
      {status}
    </span>
  );
}
