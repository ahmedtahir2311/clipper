import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobStoreService } from '../../shared/store/job-store.service';
import { QUEUE_NAMES } from '../processing/processing.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Processor(QUEUE_NAMES.CLEANUP)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly configService: ConfigService
  ) {
    super();
  }

  async process(): Promise<void> {
    const retentionDays = this.configService.get<number>('cleanup.retentionDays', 7);
    const cutoffIso = new Date(Date.now() - retentionDays * MS_PER_DAY).toISOString();

    const allJobs = await this.jobStore.ListJobs();
    const staleJobs = allJobs.filter((job) => job.createdAt < cutoffIso);
    if (staleJobs.length === 0) {
      this.logger.log('Cleanup: nothing older than retention window');
      return;
    }

    this.logger.log(`Cleanup: removing ${staleJobs.length} job(s) older than ${retentionDays} day(s)`);

    for (const staleJob of staleJobs) {
      await this.jobStore.DeleteJob(staleJob.id).catch((error: unknown) => {
        this.logger.error(`Cleanup: failed to delete job ${staleJob.id}: ${String(error)}`);
      });
    }

    this.logger.log(`Cleanup: complete`);
  }
}
