'use client';

import type { JobDto } from '@clipper/shared';
import { StatusBadge } from '@/components/atoms/badge';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { Spinner } from '@/components/atoms/spinner';
import { Button } from '@/components/atoms/button';
import { JobsService } from '@/services/jobs.service';

export function JobStatusPanel({ job }: { job: JobDto }): JSX.Element {
  const percent = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{job.sourceFilename}</h2>
          <p className="mt-1 text-sm text-gray-500">{job.progress.label}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'downloading' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner />
          <span>Downloading source video - this can take a while for longer videos.</span>
        </div>
      )}

      {job.status === 'processing' && (
        <div className="mt-4">
          <ProgressBar percent={percent} />
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-600">{job.errorMessage}</p>
      )}

      {job.status === 'completed' && job.clips && job.clips.length > 0 && (
        <a href={JobsService.GetDownloadAllUrl(job.id)}>
          <Button className="mt-4" variant="secondary" size="sm">
            Download All (.zip)
          </Button>
        </a>
      )}
    </div>
  );
}
