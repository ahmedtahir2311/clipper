import { Injectable } from '@nestjs/common';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { JobStoreService } from '../../shared/store/job-store.service';
import type { ClipRecord } from '../../shared/store/job-record.types';

@Injectable()
export class ClipsService {
  constructor(private readonly jobStore: JobStoreService) {}

  async GetClip(clipId: string): Promise<ClipRecord> {
    const found = await this.jobStore.FindClip(clipId);
    if (!found) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${clipId} not found`, 404);
    }
    return found.clip;
  }
}
