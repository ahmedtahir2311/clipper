'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JobDto } from '@clipper/shared';
import { StatusBadge } from '@/components/atoms/badge';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { Spinner } from '@/components/atoms/spinner';
import { Button } from '@/components/atoms/button';
import { JobsService } from '@/services/jobs.service';
import { FormatDuration } from '@/lib/utils';

export function JobStatusPanel({ job }: { job: JobDto }): JSX.Element {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const percent = job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0;
  const clipCount = job.clips?.length ?? 0;
  const totalClipSeconds = job.clips?.reduce((sum, clip) => sum + clip.durationSeconds, 0) ?? 0;

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Delete "${job.sourceFilename}" and all its clips? This can't be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await JobsService.Delete(job.id);
      router.push('/');
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-gray-900">{job.sourceFilename}</h2>
          <p className="mt-1 text-sm text-gray-500">{job.progress.label}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === 'completed' && clipCount > 0 && (
        <dl className="mt-4 flex gap-6 border-t border-gray-100 pt-4 text-sm">
          <div>
            <dt className="text-gray-400">Clips</dt>
            <dd className="font-medium text-gray-900">{clipCount}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Total clip time</dt>
            <dd className="font-medium text-gray-900">{FormatDuration(totalClipSeconds)}</dd>
          </div>
          {job.durationSeconds !== null && (
            <div>
              <dt className="text-gray-400">Source length</dt>
              <dd className="font-medium text-gray-900">{FormatDuration(job.durationSeconds)}</dd>
            </div>
          )}
        </dl>
      )}

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

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        {job.status === 'completed' && clipCount > 0 ? (
          <a href={JobsService.GetDownloadAllUrl(job.id)}>
            <Button variant="secondary" size="sm">
              Download all (.zip)
            </Button>
          </a>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-red-600 hover:bg-red-50">
          {isDeleting ? 'Deleting...' : 'Delete job'}
        </Button>
      </div>
    </div>
  );
}
