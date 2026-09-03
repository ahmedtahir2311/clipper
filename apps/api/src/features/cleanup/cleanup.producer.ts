import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../processing/processing.constants';

const CLEANUP_REPEATABLE_JOB_ID = 'storage-cleanup-repeatable';

@Injectable()
export class CleanupProducer {
  private readonly logger = new Logger(CleanupProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.CLEANUP) private readonly queue: Queue,
    private readonly configService: ConfigService
  ) {}

  /** Registers the recurring cleanup job. Idempotent - BullMQ dedupes repeatable jobs by their jobId. */
  async ScheduleRepeatable(): Promise<void> {
    const cron = this.configService.get<string>('cleanup.cron', '0 3 * * *');

    await this.queue.add(
      'cleanup',
      {},
      {
        jobId: CLEANUP_REPEATABLE_JOB_ID,
        repeat: { pattern: cron },
        removeOnComplete: 20,
        removeOnFail: 50,
      }
    );

    this.logger.log(`Scheduled storage cleanup with cron "${cron}"`);
  }

  /** Manual trigger, useful for testing/ops without waiting for the schedule. */
  async RunNow(): Promise<void> {
    await this.queue.add('cleanup', {}, { removeOnComplete: 20, removeOnFail: 50 });
  }
}
