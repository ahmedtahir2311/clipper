import { Inject, Injectable, Logger } from '@nestjs/common';
import archiver from 'archiver';
import type { Response } from 'express';
import type { ClipDto, JobDto } from '@clipper/shared';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { JobStoreService } from '../../shared/store/job-store.service';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import type { ClipRecord, JobRecord } from '../../shared/store/job-record.types';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly jobStore: JobStoreService
  ) {}

  async ListJobs(): Promise<JobDto[]> {
    const records = await this.jobStore.ListJobs();
    return records.map((record) => this.ToJobDto(record));
  }

  async GetJob(jobId: string): Promise<JobDto> {
    const record = await this.jobStore.RequireJob(jobId);
    return this.ToJobDto(record, record.clips.map((clip) => this.ToClipDto(record.id, clip)));
  }

  async StreamAllClipsAsZip(jobId: string, res: Response): Promise<void> {
    const record = await this.jobStore.RequireJob(jobId);
    if (record.clips.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Job ${jobId} has no clips yet`, 404);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="job-${jobId}-clips.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
      // Headers are already sent by this point (set above), so the best we
      // can do is log and tear down the connection - throwing here would be
      // an uncaught exception outside any request promise chain, which can
      // crash the whole process.
      this.logger.error(`Zip stream failed for job ${jobId}: ${error.message}`);
      res.destroy(error);
    });
    archive.pipe(res);

    for (const clip of record.clips) {
      archive.append(this.storage.ReadStream(clip.filePath), { name: `clip-${clip.sequence}.mp4` });
    }

    await archive.finalize();
  }

  async DeleteJob(jobId: string): Promise<void> {
    await this.jobStore.RequireJob(jobId);
    await this.jobStore.DeleteJob(jobId);
  }

  private ToJobDto(record: JobRecord, clipDtos?: ClipDto[]): JobDto {
    return {
      id: record.id,
      status: record.status,
      sourceFilename: record.sourceFilename,
      durationSeconds: record.durationSeconds,
      progress: {
        current: record.progressCurrent,
        total: record.progressTotal,
        label: this.FormatProgressLabel(record.status, record.progressCurrent, record.progressTotal),
      },
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(clipDtos ? { clips: clipDtos } : {}),
    };
  }

  private ToClipDto(jobId: string, clip: ClipRecord): ClipDto {
    return {
      id: clip.id,
      jobId,
      sequence: clip.sequence,
      startTime: clip.startTime,
      endTime: clip.endTime,
      durationSeconds: clip.durationSeconds,
      // Relative to the API base URL, which already includes the /api/v1
      // prefix on the frontend (see apps/web/src/config/constants.ts) - do
      // not prefix with /api/v1 here or clients double it up.
      downloadUrl: `/clips/${clip.id}/download`,
      thumbnailUrl: clip.thumbnailPath ? `/clips/${clip.id}/thumbnail` : null,
      createdAt: clip.createdAt,
    };
  }

  private FormatProgressLabel(status: string, current: number, total: number): string {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'downloading':
        return 'Downloading video...';
      case 'processing':
        return total > 0 ? `Generating clip ${current}/${total}` : 'Analyzing video...';
      case 'completed':
        return `Completed - ${total} clip${total === 1 ? '' : 's'} generated`;
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }
}
