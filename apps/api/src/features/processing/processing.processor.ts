import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { Job as BullJob } from 'bullmq';
import { clips, jobs, type Database } from '@clipper/db';
import { DATABASE_CLIENT } from '../../database/database.module';
import { AppError } from '../../shared/errors/app-error';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { SelectClipWindows, type ClipSelectionConfig } from '../../shared/ffmpeg/clip-selection.util';
import { SilenceDetectService } from '../../shared/ffmpeg/silence-detect.service';
import { VideoProbeService } from '../../shared/ffmpeg/video-probe.service';
import { VideoTransformService } from '../../shared/ffmpeg/video-transform.service';
import { QUEUE_NAMES, type ClipGenerationJobData } from './processing.constants';

@Processor(QUEUE_NAMES.CLIP_GENERATION, { concurrency: 1 })
export class ClipGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ClipGenerationProcessor.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly configService: ConfigService,
    private readonly videoProbeService: VideoProbeService,
    private readonly silenceDetectService: SilenceDetectService,
    private readonly videoTransformService: VideoTransformService
  ) {
    super();
  }

  async process(bullJob: BullJob<ClipGenerationJobData>): Promise<void> {
    const { jobId } = bullJob.data;
    this.logger.log(`Starting clip generation for job ${jobId}`);

    const [jobRow] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!jobRow) {
      this.logger.error(`Job ${jobId} not found, skipping`);
      return;
    }

    await this.SetJobStatus(jobId, 'processing', { progressCurrent: 0, progressTotal: 0 });

    const tmpDir = `jobs/${jobId}/tmp`;
    const clipsDir = `jobs/${jobId}/clips`;

    try {
      const absoluteSourcePath = this.storage.GetAbsolutePath(jobRow.sourcePath);
      const probe = await this.videoProbeService.Probe(absoluteSourcePath);

      const noiseDb = this.configService.get<number>('clip.silenceNoiseDb', -30);
      const minSilenceDuration = this.configService.get<number>('clip.silenceMinDurationSeconds', 0.5);
      const silenceIntervals = await this.silenceDetectService.Detect(
        absoluteSourcePath,
        noiseDb,
        minSilenceDuration,
        probe.durationSeconds
      );
      this.logger.log(`Job ${jobId}: detected ${silenceIntervals.length} silence interval(s)`);

      const selectionConfig: ClipSelectionConfig = {
        minClipDurationSeconds: this.configService.get<number>('clip.minDurationSeconds', 15),
        maxClipDurationSeconds: this.configService.get<number>('clip.maxDurationSeconds', 60),
        targetClipCountMin: this.configService.get<number>('clip.targetCountMin', 7),
        targetClipCountMax: this.configService.get<number>('clip.targetCountMax', 10),
        snapWindowSeconds: this.configService.get<number>('clip.silenceSnapWindowSeconds', 5),
      };
      const windows = SelectClipWindows(probe.durationSeconds, silenceIntervals, selectionConfig);
      this.logger.log(`Job ${jobId}: selected ${windows.length} clip window(s)`);

      await this.SetJobStatus(jobId, 'processing', { progressCurrent: 0, progressTotal: windows.length });
      await this.storage.EnsureDirectory(tmpDir);
      await this.storage.EnsureDirectory(clipsDir);

      for (let i = 0; i < windows.length; i += 1) {
        const window = windows[i];
        const sequence = i + 1;
        this.logger.log(`Job ${jobId}: generating clip ${sequence}/${windows.length} [${window.startTime}s - ${window.endTime}s]`);

        const trimRelativePath = `${tmpDir}/clip-${sequence}-trim.mp4`;
        const clipRelativePath = `${clipsDir}/clip-${sequence}.mp4`;
        const thumbnailRelativePath = `${clipsDir}/clip-${sequence}.jpg`;

        const trimAbsolute = this.storage.GetAbsolutePath(trimRelativePath);
        const clipAbsolute = this.storage.GetAbsolutePath(clipRelativePath);
        const thumbnailAbsolute = this.storage.GetAbsolutePath(thumbnailRelativePath);

        await this.videoTransformService.TrimSegment(absoluteSourcePath, trimAbsolute, window.startTime, window.endTime);
        await this.videoTransformService.ReframeToVertical(trimAbsolute, clipAbsolute, probe.width, probe.height);
        await this.videoTransformService.GenerateThumbnail(clipAbsolute, thumbnailAbsolute);
        await this.storage.Delete(trimRelativePath);

        await this.db.insert(clips).values({
          jobId,
          sequence,
          filePath: clipRelativePath,
          thumbnailPath: thumbnailRelativePath,
          startTime: window.startTime,
          endTime: window.endTime,
          durationSeconds: window.endTime - window.startTime,
        });

        await this.SetJobStatus(jobId, 'processing', { progressCurrent: sequence, progressTotal: windows.length });
        await bullJob.updateProgress(Math.round((sequence / windows.length) * 100));
      }

      await this.storage.DeleteDirectory(tmpDir);
      await this.SetJobStatus(jobId, 'completed', { progressCurrent: windows.length, progressTotal: windows.length });
      this.logger.log(`Job ${jobId}: completed with ${windows.length} clip(s)`);
    } catch (error) {
      await this.storage.DeleteDirectory(tmpDir).catch(() => undefined);
      const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Job ${jobId}: failed - ${message}`);
      await this.SetJobStatus(jobId, 'failed', { errorMessage: message });
      throw error;
    }
  }

  private async SetJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    fields: { progressCurrent?: number; progressTotal?: number; errorMessage?: string }
  ): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status, updatedAt: new Date(), ...fields })
      .where(eq(jobs.id, jobId));
  }
}
