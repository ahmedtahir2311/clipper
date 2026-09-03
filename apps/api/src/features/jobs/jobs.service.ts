import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import archiver from 'archiver';
import type { Response } from 'express';
import { clips, jobs, type Database } from '@clipper/db';
import type { ClipDto, JobDto } from '@clipper/shared';
import { DATABASE_CLIENT } from '../../database/database.module';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';

@Injectable()
export class JobsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver
  ) {}

  async ListJobs(): Promise<JobDto[]> {
    const rows = await this.db.select().from(jobs).orderBy(desc(jobs.createdAt));
    return rows.map((row) => this.ToJobDto(row));
  }

  async GetJob(jobId: string): Promise<JobDto> {
    const [row] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!row) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Job ${jobId} not found`, 404);
    }

    const clipRows = await this.db.select().from(clips).where(eq(clips.jobId, jobId)).orderBy(clips.sequence);

    return this.ToJobDto(row, clipRows.map((clip) => this.ToClipDto(clip)));
  }

  async StreamAllClipsAsZip(jobId: string, res: Response): Promise<void> {
    const [row] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!row) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Job ${jobId} not found`, 404);
    }

    const clipRows = await this.db.select().from(clips).where(eq(clips.jobId, jobId)).orderBy(clips.sequence);
    if (clipRows.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Job ${jobId} has no clips yet`, 404);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="job-${jobId}-clips.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
      throw error;
    });
    archive.pipe(res);

    for (const clip of clipRows) {
      archive.append(this.storage.ReadStream(clip.filePath), { name: `clip-${clip.sequence}.mp4` });
    }

    await archive.finalize();
  }

  async DeleteJob(jobId: string): Promise<void> {
    const [row] = await this.db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!row) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Job ${jobId} not found`, 404);
    }

    await this.storage.DeleteDirectory(`jobs/${jobId}`);
    await this.db.delete(jobs).where(eq(jobs.id, jobId));
  }

  private ToJobDto(row: typeof jobs.$inferSelect, clipDtos?: ClipDto[]): JobDto {
    return {
      id: row.id,
      status: row.status,
      sourceFilename: row.sourceFilename,
      durationSeconds: row.durationSeconds,
      progress: {
        current: row.progressCurrent,
        total: row.progressTotal,
        label: this.FormatProgressLabel(row.status, row.progressCurrent, row.progressTotal),
      },
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ...(clipDtos ? { clips: clipDtos } : {}),
    };
  }

  private ToClipDto(row: typeof clips.$inferSelect): ClipDto {
    return {
      id: row.id,
      jobId: row.jobId,
      sequence: row.sequence,
      startTime: row.startTime,
      endTime: row.endTime,
      durationSeconds: row.durationSeconds,
      downloadUrl: `/api/v1/clips/${row.id}/download`,
      thumbnailUrl: row.thumbnailPath ? `/api/v1/clips/${row.id}/thumbnail` : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private FormatProgressLabel(status: string, current: number, total: number): string {
    switch (status) {
      case 'pending':
        return 'Queued';
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
