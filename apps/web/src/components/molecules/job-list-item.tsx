import Link from 'next/link';
import type { JobDto } from '@clipper/shared';
import { StatusBadge } from '@/components/atoms/badge';
import { FormatDate } from '@/lib/utils';

export function JobListItem({ job }: { job: JobDto }): JSX.Element {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300"
    >
      <div>
        <p className="font-medium text-gray-900">{job.sourceFilename}</p>
        <p className="text-sm text-gray-500">{job.progress.label}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{FormatDate(job.createdAt)}</span>
        <StatusBadge status={job.status} />
      </div>
    </Link>
  );
}
