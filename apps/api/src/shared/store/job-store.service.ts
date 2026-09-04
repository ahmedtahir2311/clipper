import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { CaptionSegment, CaptionStyle } from '@clipper/shared';
import { AppError, ErrorCodes } from '../errors/app-error';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.interface';
import type { ClipRecord, JobRecord, NewClipRecord, NewJobRecord } from './job-record.types';

const CLIPS_INDEX_PATH = 'clips-index.json';

type ClipsIndex = Record<string, string>;

const JobDir = (jobId: string): string => `jobs/${jobId}`;
const JobFilePath = (jobId: string): string => `${JobDir(jobId)}/job.json`;

/**
 * Replaces Postgres/Drizzle for this internal, single-user tool: one
 * job.json per job (with its clips embedded) under storage/jobs/<id>/, plus
 * a small clips-index.json mapping clipId -> jobId so GET /clips/:id can
 * resolve without scanning every job. There's no cross-process locking -
 * that's fine here because only the HTTP process creates/deletes jobs and
 * only the worker (at concurrency 1) updates a job while it owns it, so the
 * two never write the same job concurrently.
 */
@Injectable()
export class JobStoreService {
  private readonly logger = new Logger(JobStoreService.name);

  constructor(@Inject(STORAGE_DRIVER) private readonly storage: StorageDriver) {}

  async CreateJob(data: NewJobRecord): Promise<JobRecord> {
    const now = new Date().toISOString();
    const record: JobRecord = {
      id: uuidv4(),
      status: data.status ?? 'pending',
      sourceFilename: data.sourceFilename,
      sourcePath: data.sourcePath,
      sourceUrl: data.sourceUrl ?? null,
      durationSeconds: data.durationSeconds ?? null,
      progressCurrent: 0,
      progressTotal: 0,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
      clips: [],
    };

    await this.storage.EnsureDirectory(JobDir(record.id));
    await this.WriteJob(record);

    return record;
  }

  async GetJob(jobId: string): Promise<JobRecord | null> {
    const filePath = JobFilePath(jobId);
    if (!(await this.storage.Exists(filePath))) {
      return null;
    }

    try {
      const raw = await this.storage.ReadFile(filePath);
      return JSON.parse(raw.toString('utf8')) as JobRecord;
    } catch (error) {
      this.logger.error(`Failed to read/parse ${filePath}: ${String(error)}`);
      return null;
    }
  }

  async RequireJob(jobId: string): Promise<JobRecord> {
    const job = await this.GetJob(jobId);
    if (!job) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Job ${jobId} not found`, 404);
    }
    return job;
  }

  async ListJobs(): Promise<JobRecord[]> {
    const jobIds = await this.storage.ListDirectories('jobs');
    const jobs = await Promise.all(jobIds.map((id) => this.GetJob(id)));
    return jobs.filter((job): job is JobRecord => job !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async UpdateJob(jobId: string, patch: Partial<Omit<JobRecord, 'id' | 'createdAt' | 'clips'>>): Promise<JobRecord> {
    const existing = await this.RequireJob(jobId);
    const updated: JobRecord = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await this.WriteJob(updated);
    return updated;
  }

  async DeleteJob(jobId: string): Promise<void> {
    const job = await this.GetJob(jobId);
    await this.storage.DeleteDirectory(JobDir(jobId));

    if (job && job.clips.length > 0) {
      const index = await this.ReadClipsIndex();
      for (const clip of job.clips) {
        delete index[clip.id];
      }
      await this.WriteClipsIndex(index);
    }
  }

  async AddClip(jobId: string, data: NewClipRecord): Promise<ClipRecord> {
    const job = await this.RequireJob(jobId);
    const clip: ClipRecord = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      captionStatus: 'none',
      captionStyle: null,
      captionSegments: null,
      captionedFilePath: null,
      captionError: null,
      ...data,
    };

    job.clips.push(clip);
    job.updatedAt = new Date().toISOString();
    await this.WriteJob(job);

    const index = await this.ReadClipsIndex();
    index[clip.id] = jobId;
    await this.WriteClipsIndex(index);

    return clip;
  }

  async SetClipCaptionPending(clipId: string, style: CaptionStyle, segments: CaptionSegment[]): Promise<ClipRecord> {
    return this.UpdateClip(clipId, {
      captionStatus: 'pending',
      captionStyle: style,
      captionSegments: segments,
      captionError: null,
    });
  }

  async SetClipCaptionReady(clipId: string, captionedFilePath: string): Promise<ClipRecord> {
    return this.UpdateClip(clipId, { captionStatus: 'ready', captionedFilePath, captionError: null });
  }

  async SetClipCaptionFailed(clipId: string, errorMessage: string): Promise<ClipRecord> {
    return this.UpdateClip(clipId, { captionStatus: 'failed', captionError: errorMessage });
  }

  async ClearClipCaptions(clipId: string): Promise<ClipRecord> {
    return this.UpdateClip(clipId, {
      captionStatus: 'none',
      captionStyle: null,
      captionSegments: null,
      captionedFilePath: null,
      captionError: null,
    });
  }

  private async UpdateClip(clipId: string, patch: Partial<Omit<ClipRecord, 'id' | 'createdAt'>>): Promise<ClipRecord> {
    const found = await this.FindClip(clipId);
    if (!found) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} not found`, 404);
    }

    const { job, clip } = found;
    const updatedClip: ClipRecord = { ...clip, ...patch };
    job.clips = job.clips.map((c) => (c.id === clipId ? updatedClip : c));
    job.updatedAt = new Date().toISOString();
    await this.WriteJob(job);

    return updatedClip;
  }

  async FindClip(clipId: string): Promise<{ job: JobRecord; clip: ClipRecord } | null> {
    const index = await this.ReadClipsIndex();
    const jobId = index[clipId];
    if (!jobId) {
      return null;
    }

    const job = await this.GetJob(jobId);
    const clip = job?.clips.find((c) => c.id === clipId);
    if (!job || !clip) {
      return null;
    }

    return { job, clip };
  }

  private async WriteJob(record: JobRecord): Promise<void> {
    await this.storage.WriteFile(JobFilePath(record.id), Buffer.from(JSON.stringify(record, null, 2)));
  }

  private async ReadClipsIndex(): Promise<ClipsIndex> {
    if (!(await this.storage.Exists(CLIPS_INDEX_PATH))) {
      return {};
    }
    try {
      const raw = await this.storage.ReadFile(CLIPS_INDEX_PATH);
      return JSON.parse(raw.toString('utf8')) as ClipsIndex;
    } catch (error) {
      this.logger.error(`Failed to read/parse ${CLIPS_INDEX_PATH}: ${String(error)}`);
      return {};
    }
  }

  private async WriteClipsIndex(index: ClipsIndex): Promise<void> {
    await this.storage.WriteFile(CLIPS_INDEX_PATH, Buffer.from(JSON.stringify(index, null, 2)));
  }
}
