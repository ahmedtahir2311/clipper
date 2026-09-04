import { Controller, Get, Inject, Logger, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { ApiResponse } from '../../shared/utils/api-response.util';
import { ClipsService } from './clips.service';

const ClipIdParamSchema = z.object({ id: z.string().uuid() });

@Controller('clips')
export class ClipsController {
  private readonly logger = new Logger(ClipsController.name);

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
    this.PipeToResponse(this.storage.ReadStream(clip.filePath), res, `Streaming clip ${id}`);
  }

  @Get(':id/thumbnail')
  async Thumbnail(@Param() params: unknown, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.GetClip(id);

    if (!clip.thumbnailPath) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Clip ${id} has no thumbnail`, 404);
    }

    res.setHeader('Content-Type', 'image/jpeg');
    this.PipeToResponse(this.storage.ReadStream(clip.thumbnailPath), res, `Streaming thumbnail for clip ${id}`);
  }

  /**
   * A read stream can fail (e.g. ENOENT) after piping has started. An
   * unhandled 'error' event on the stream would crash the process, so this
   * always handles it: if nothing has been written to the response yet, send
   * a proper JSON 404; otherwise the connection is already committed, so
   * just log and tear it down.
   */
  private PipeToResponse(stream: Readable, res: Response, errorContext: string): void {
    stream.on('error', (error: NodeJS.ErrnoException) => {
      this.logger.error(`${errorContext}: ${error.message}`);
      if (!res.headersSent) {
        ApiResponse.Error(res, ErrorCodes.NOT_FOUND, 'File not found', 404);
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
  }
}
