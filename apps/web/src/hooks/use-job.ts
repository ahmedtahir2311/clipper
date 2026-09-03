import { useQuery } from '@tanstack/react-query';
import { JobsService } from '@/services/jobs.service';
import { JOB_POLL_INTERVAL_MS } from '@/config/constants';

export function UseJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => JobsService.GetById(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : JOB_POLL_INTERVAL_MS;
    },
  });
}
