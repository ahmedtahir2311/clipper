import { useQuery } from '@tanstack/react-query';
import { JobsService } from '@/services/jobs.service';

export function UseJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: JobsService.List,
    refetchInterval: 5000,
  });
}
