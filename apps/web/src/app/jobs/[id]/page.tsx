'use client';

import { DashboardLayout } from '@/components/templates/dashboard-layout';
import { JobStatusPanel } from '@/components/organisms/job-status-panel';
import { ClipsGrid } from '@/components/organisms/clips-grid';
import { Spinner } from '@/components/atoms/spinner';
import { UseJob } from '@/hooks/use-job';

export default function JobDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const { id } = params;
  const { data: job, isLoading, isError } = UseJob(id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !job) {
    return (
      <DashboardLayout>
        <p className="text-sm text-red-500">Failed to load job.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <JobStatusPanel job={job} />
        {job.status === 'completed' && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Clips</h2>
            <ClipsGrid clips={job.clips ?? []} />
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
