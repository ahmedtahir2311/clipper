'use client';

import { UseJobs } from '@/hooks/use-jobs';
import { JobListItem } from '@/components/molecules/job-list-item';
import { Spinner } from '@/components/atoms/spinner';

export function JobsList(): JSX.Element {
  const { data: jobs, isLoading, isError } = UseJobs();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-red-500">Failed to load jobs.</p>;
  }

  if (!jobs || jobs.length === 0) {
    return <p className="text-sm text-gray-500">No videos uploaded yet.</p>;
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobListItem key={job.id} job={job} />
      ))}
    </div>
  );
}
