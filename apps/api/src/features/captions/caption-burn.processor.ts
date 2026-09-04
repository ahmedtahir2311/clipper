import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job as BullJob } from 'bullmq';
import { AppError } from '../../shared/errors/app-error';
import { BuildAssSubtitle } from '../../shared/ffmpeg/ass-subtitle-builder';
import { FfmpegService } from '../../shared/ffmpeg/ffmpeg.service';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { JobStoreService } from '../../shared/store/job-store.service';
import { QUEUE_NAMES, type CaptionBurnJobData } from '../processing/processing.constants';

/** Escapes a path for use inside an ffmpeg filtergraph option (the ass filter's own argument parser treats ':' specially). */
function EscapeFilterPath(absolutePath: string): string {
  return absolutePath.replace(/\\/g, '/').replace(/:/g, '\\:');
}

@Processor(QUEUE_NAMES.CAPTION_BURN, { concurrency: 1 })
export class CaptionBurnProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptionBurnProcessor.name);

  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly jobStore: JobStoreService,
    private readonly ffmpegService: FfmpegService
  ) {
    super();
  }

  async process(bullJob: BullJob<CaptionBurnJobData>): Promise<void> {
    const { clipId } = bullJob.data;
    this.logger.log(`Starting caption burn for clip ${clipId}`);

    const found = await this.jobStore.FindClip(clipId);
    if (!found) {
      this.logger.error(`Clip ${clipId} not found, skipping`);
      return;
    }

    const { job, clip } = found;
    if (!clip.captionStyle || !clip.captionSegments) {
      this.logger.error(`Clip ${clipId} has no pending caption request, skipping`);
      return;
    }

    const assRelativePath = `jobs/${job.id}/tmp/clip-${clip.sequence}-captions.ass`;
    const captionedRelativePath = `jobs/${job.id}/clips/clip-${clip.sequence}-captioned.mp4`;

    try {
      await this.storage.EnsureDirectory(`jobs/${job.id}/tmp`);
      const assContent = BuildAssSubtitle(clip.captionStyle, clip.captionSegments);
      await this.storage.WriteFile(assRelativePath, Buffer.from(assContent, 'utf8'));

      const absoluteSourcePath = this.storage.GetAbsolutePath(clip.filePath);
      const absoluteAssPath = this.storage.GetAbsolutePath(assRelativePath);
      const absoluteOutputPath = this.storage.GetAbsolutePath(captionedRelativePath);

      await this.ffmpegService.RunFfmpeg([
        '-y',
        '-i',
        absoluteSourcePath,
        '-vf',
        `ass=${EscapeFilterPath(absoluteAssPath)}`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-c:a',
        'copy',
        absoluteOutputPath,
      ]);

      await this.storage.Delete(assRelativePath);
      await this.jobStore.SetClipCaptionReady(clipId, captionedRelativePath);
      this.logger.log(`Clip ${clipId}: captions ready (style: ${clip.captionStyle})`);
    } catch (error) {
      await this.storage.Delete(assRelativePath).catch(() => undefined);
      const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Clip ${clipId}: caption burn failed - ${message}`);
      await this.jobStore.SetClipCaptionFailed(clipId, message);
      throw error;
    }
  }
}
