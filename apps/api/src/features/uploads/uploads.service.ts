import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { jobs } from '@clipper/db';
import type { ImportFromUrlDto, InitiateUploadDto } from '@clipper/shared';
import { DATABASE_CLIENT } from '../../database/database.module';
import type { Database } from '@clipper/db';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { VideoProbeService } from '../../shared/ffmpeg/video-probe.service';
import { YtDlpService } from '../../shared/yt-dlp/yt-dlp.service';
import { ProcessingProducer } from '../processing/processing.producer';
import { MIME_TO_EXTENSION, type UploadMeta } from './uploads.types';

const UPLOAD_DIR = (uploadId: string): string => `uploads/${uploadId}`;
const UPLOAD_META_PATH = (uploadId: string): string => `${UPLOAD_DIR(uploadId)}/meta.json`;
const UPLOAD_TMP_PATH = (uploadId: string): string => `${UPLOAD_DIR(uploadId)}/source.part`;

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: Database,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly configService: ConfigService,
    private readonly videoProbeService: VideoProbeService,
    private readonly ytDlpService: YtDlpService,
    private readonly processingProducer: ProcessingProducer
  ) {}

  async InitiateUpload(dto: InitiateUploadDto): Promise<{ uploadId: string }> {
    const maxUploadBytes = this.configService.get<number>('storage.maxUploadBytes', 2 * 1024 * 1024 * 1024);
    if (dto.fileSizeBytes > maxUploadBytes) {
      throw new AppError(ErrorCodes.UPLOAD_TOO_LARGE, `File exceeds maximum upload size of ${maxUploadBytes} bytes`, 413);
    }

    if (!MIME_TO_EXTENSION[dto.mimeType]) {
      throw new AppError(ErrorCodes.UNSUPPORTED_FORMAT, `Unsupported format: ${dto.mimeType}`, 415);
    }

    const uploadId = uuidv4();
    await this.storage.EnsureDirectory(UPLOAD_DIR(uploadId));

    const meta: UploadMeta = {
      uploadId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      fileSizeBytes: dto.fileSizeBytes,
      totalChunks: dto.totalChunks,
      nextExpectedChunkIndex: 0,
      bytesReceived: 0,
    };
    await this.WriteMeta(meta);

    return { uploadId };
  }

  async GetStatus(uploadId: string): Promise<UploadMeta> {
    return this.ReadMeta(uploadId);
  }

  async WriteChunk(uploadId: string, chunkIndex: number, data: Buffer): Promise<UploadMeta> {
    const meta = await this.ReadMeta(uploadId);

    if (chunkIndex !== meta.nextExpectedChunkIndex) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        `Expected chunk ${meta.nextExpectedChunkIndex}, received ${chunkIndex}`,
        409
      );
    }

    await this.storage.AppendFile(UPLOAD_TMP_PATH(uploadId), data);

    meta.nextExpectedChunkIndex += 1;
    meta.bytesReceived += data.byteLength;
    await this.WriteMeta(meta);

    return meta;
  }

  async CompleteUpload(uploadId: string): Promise<{ jobId: string }> {
    const meta = await this.ReadMeta(uploadId);

    if (meta.nextExpectedChunkIndex !== meta.totalChunks) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        `Upload incomplete: received ${meta.nextExpectedChunkIndex}/${meta.totalChunks} chunks`,
        409
      );
    }

    const extension = MIME_TO_EXTENSION[meta.mimeType];
    const [job] = await this.db
      .insert(jobs)
      .values({
        status: 'pending',
        sourceFilename: meta.filename,
        sourcePath: '',
      })
      .returning();

    const finalRelativePath = `jobs/${job.id}/source.${extension}`;
    await this.storage.Move(UPLOAD_TMP_PATH(uploadId), finalRelativePath);
    await this.storage.Delete(UPLOAD_META_PATH(uploadId));

    const probe = await this.videoProbeService.Probe(this.storage.GetAbsolutePath(finalRelativePath));

    await this.db
      .update(jobs)
      .set({ sourcePath: finalRelativePath, durationSeconds: Math.round(probe.durationSeconds), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    await this.processingProducer.EnqueueClipGeneration(job.id);

    return { jobId: job.id };
  }

  /**
   * Starts a job from a YouTube URL instead of a direct file upload. Fetches
   * metadata synchronously (bounded by YT_DLP_METADATA_TIMEOUT_MS, same
   * pattern as the ffprobe call in CompleteUpload) so we can validate and
   * report a title/duration immediately; the actual download - which can
   * take minutes - happens in the worker via the source-download queue, so
   * this still returns to the client right away.
   *
   * Only import videos you own or otherwise have the rights to clip -
   * downloading third-party YouTube content may violate YouTube's Terms of
   * Service depending on how the clips are used.
   */
  async ImportFromUrl(dto: ImportFromUrlDto): Promise<{ jobId: string }> {
    const metadata = await this.ytDlpService.FetchMetadata(dto.url);

    if (metadata.isLive) {
      throw new AppError(ErrorCodes.YOUTUBE_IMPORT_FAILED, 'Live streams are not supported', 422);
    }

    const maxDurationSeconds = this.configService.get<number>('youtubeImport.maxDurationSeconds', 7200);
    if (metadata.durationSeconds > maxDurationSeconds) {
      throw new AppError(
        ErrorCodes.YOUTUBE_VIDEO_TOO_LONG,
        `Video is ${Math.round(metadata.durationSeconds)}s long, which exceeds the ${maxDurationSeconds}s import limit`,
        422
      );
    }

    const [job] = await this.db
      .insert(jobs)
      .values({
        status: 'pending',
        sourceFilename: metadata.title,
        sourcePath: '',
        sourceUrl: dto.url,
        durationSeconds: Math.round(metadata.durationSeconds),
      })
      .returning();

    await this.processingProducer.EnqueueSourceDownload(job.id, dto.url);

    return { jobId: job.id };
  }

  private async ReadMeta(uploadId: string): Promise<UploadMeta> {
    const exists = await this.storage.Exists(UPLOAD_META_PATH(uploadId));
    if (!exists) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Upload ${uploadId} not found`, 404);
    }
    const raw = await this.storage.ReadFile(UPLOAD_META_PATH(uploadId));
    return JSON.parse(raw.toString('utf8')) as UploadMeta;
  }

  private async WriteMeta(meta: UploadMeta): Promise<void> {
    await this.storage.WriteFile(UPLOAD_META_PATH(meta.uploadId), Buffer.from(JSON.stringify(meta)));
  }
}
