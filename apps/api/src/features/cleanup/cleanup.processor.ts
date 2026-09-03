import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, lt } from 'drizzle-orm';
import { jobs, type Database } from '@clipper/db';
import { DATABASE_CLIENT } from '../../database/database.module';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { QUEUE_NAMES } from '../processing/processing.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Processor(QUEUE_NAMES.CLEANUP)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly configService: ConfigService
  ) {
    super();
  }

  async process(): Promise<void> {
    const retentionDays = this.configService.get<number>('cleanup.retentionDays', 7);
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);

    const staleJobs = await this.db.select().from(jobs).where(lt(jobs.createdAt, cutoff));
    if (staleJobs.length === 0) {
      this.logger.log('Cleanup: nothing older than retention window');
      return;
    }

    this.logger.log(`Cleanup: removing ${staleJobs.length} job(s) older than ${retentionDays} day(s)`);

    for (const staleJob of staleJobs) {
      await this.storage.DeleteDirectory(`jobs/${staleJob.id}`).catch((error: unknown) => {
        this.logger.error(`Cleanup: failed to delete storage for job ${staleJob.id}: ${String(error)}`);
      });
      // clips rows cascade-delete via FK ON DELETE CASCADE
      await this.db.delete(jobs).where(eq(jobs.id, staleJob.id));
    }

    this.logger.log(`Cleanup: complete`);
  }
}
