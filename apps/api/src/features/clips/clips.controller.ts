import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthGuard } from '../../shared/auth/auth.guard';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { ClipsService } from './clips.service';

const ClipIdParamSchema = z.object({ id: z.string().uuid() });

@Controller('clips')
@UseGuards(AuthGuard)
export class ClipsController {
  constructor(
    private readonly clipsService: ClipsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver
  ) {}

  @Get(':id/download')
  async Download(@Param() params: unknown, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.GetClip(id);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="clip-${clip.sequence}.mp4"`);
    this.storage.ReadStream(clip.filePath).pipe(res);
  }

  @Get(':id/thumbnail')
  async Thumbnail(@Param() params: unknown, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.GetClip(id);

    if (!clip.thumbnailPath) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${id} has no thumbnail`, 404);
    }

    res.setHeader('Content-Type', 'image/jpeg');
    this.storage.ReadStream(clip.thumbnailPath).pipe(res);
  }
}
