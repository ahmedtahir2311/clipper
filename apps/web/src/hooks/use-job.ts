import { useQuery } from '@tanstack/react-query';
import { JobsService } from '@/services/jobs.service';
import { JOB_POLL_INTERVAL_MS } from '@/config/constants';

export function UseJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => JobsService.GetById(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return JOB_POLL_INTERVAL_MS;

      const jobStillRunning = job.status !== 'completed' && job.status !== 'failed';
      const captionsStillBurning = job.clips?.some((clip) => clip.captionStatus === 'pending') ?? false;

      return jobStillRunning || captionsStillBurning ? JOB_POLL_INTERVAL_MS : false;
    },
  });
}
