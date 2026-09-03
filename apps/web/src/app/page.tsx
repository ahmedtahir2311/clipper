import { DashboardLayout } from '@/components/templates/dashboard-layout';
import { UploadForm } from '@/components/organisms/upload-form';
import { JobsList } from '@/components/organisms/jobs-list';

export default function DashboardPage(): JSX.Element {
  return (
    <DashboardLayout>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Upload a video</h2>
        <UploadForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Recent jobs</h2>
        <JobsList />
      </section>
    </DashboardLayout>
  );
}
