import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job as BullJob } from 'bullmq';
import { AppError } from '../../shared/errors/app-error';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { YtDlpService } from '../../shared/yt-dlp/yt-dlp.service';
import { JobStoreService } from '../../shared/store/job-store.service';
import { QUEUE_NAMES, type SourceDownloadJobData } from './processing.constants';
import { ProcessingProducer } from './processing.producer';

@Processor(QUEUE_NAMES.SOURCE_DOWNLOAD, { concurrency: 1 })
export class SourceDownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(SourceDownloadProcessor.name);

  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly jobStore: JobStoreService,
    private readonly ytDlpService: YtDlpService,
    private readonly processingProducer: ProcessingProducer
  ) {
    super();
  }

  async process(bullJob: BullJob<SourceDownloadJobData>): Promise<void> {
    const { jobId, url } = bullJob.data;
    this.logger.log(`Starting YouTube download for job ${jobId}: ${url}`);

    const jobRecord = await this.jobStore.GetJob(jobId);
    if (!jobRecord) {
      this.logger.error(`Job ${jobId} not found, skipping`);
      return;
    }

    await this.jobStore.UpdateJob(jobId, { status: 'downloading' });

    try {
      const sourceRelativePath = `jobs/${jobId}/source.mp4`;
      await this.storage.EnsureDirectory(`jobs/${jobId}`);
      const absoluteOutputPath = this.storage.GetAbsolutePath(sourceRelativePath);

      await this.ytDlpService.DownloadVideo(url, absoluteOutputPath);
      this.logger.log(`Job ${jobId}: download complete`);

      await this.jobStore.UpdateJob(jobId, { sourcePath: sourceRelativePath });

      await this.processingProducer.EnqueueClipGeneration(jobId);
    } catch (error) {
      const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Job ${jobId}: download failed - ${message}`);
      await this.jobStore.UpdateJob(jobId, { status: 'failed', errorMessage: message });
      throw error;
    }
  }
}
