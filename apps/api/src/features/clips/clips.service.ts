import { Inject, Injectable } from '@nestjs/common';
import type { ClipDto, SetCaptionsDto } from '@clipper/shared';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { ToClipDto } from '../../shared/dto/clip.mapper';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { JobStoreService } from '../../shared/store/job-store.service';
import type { ClipRecord } from '../../shared/store/job-record.types';
import { ProcessingProducer } from '../processing/processing.producer';

/** How far past the clip's own duration a caption segment's endTime may extend before being rejected as nonsensical. */
const CAPTION_TIME_TOLERANCE_SECONDS = 0.5;

@Injectable()
export class ClipsService {
  constructor(
    private readonly jobStore: JobStoreService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly processingProducer: ProcessingProducer
  ) {}

  async GetClip(clipId: string): Promise<ClipRecord> {
    const found = await this.jobStore.FindClip(clipId);
    if (!found) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} not found`, 404);
    }
    return found.clip;
  }

  async GetCaptionedClip(clipId: string): Promise<ClipRecord> {
    const clip = await this.GetClip(clipId);
    if (clip.captionStatus !== 'ready' || !clip.captionedFilePath) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} has no ready captioned version`, 404);
    }
    return clip;
  }

  async SetCaptions(clipId: string, dto: SetCaptionsDto): Promise<ClipDto> {
    const found = await this.jobStore.FindClip(clipId);
    if (!found) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} not found`, 404);
    }

    const maxAllowedTime = found.clip.durationSeconds + CAPTION_TIME_TOLERANCE_SECONDS;
    const outOfBounds = dto.segments.find((segment) => segment.endTime > maxAllowedTime);
    if (outOfBounds) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Caption segment ends at ${outOfBounds.endTime}s, past the clip's ${found.clip.durationSeconds}s duration`,
        400
      );
    }

    const updated = await this.jobStore.SetClipCaptionPending(clipId, dto.style, dto.segments);
    await this.processingProducer.EnqueueCaptionBurn(clipId);

    return ToClipDto(found.job.id, updated);
  }

  async ClearCaptions(clipId: string): Promise<ClipDto> {
    const found = await this.jobStore.FindClip(clipId);
    if (!found) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} not found`, 404);
    }

    if (found.clip.captionedFilePath) {
      await this.storage.Delete(found.clip.captionedFilePath).catch(() => undefined);
    }

    const updated = await this.jobStore.ClearClipCaptions(clipId);
    return ToClipDto(found.job.id, updated);
  }
}
