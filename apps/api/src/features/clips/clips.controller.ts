import { Body, Controller, Delete, Get, HttpCode, Inject, Logger, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import { SetCaptionsSchema } from '@clipper/shared';
import { STORAGE_DRIVER, type StorageDriver } from '../../shared/storage/storage.interface';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { ApiResponse } from '../../shared/utils/api-response.util';
import { ClipsService } from './clips.service';

const ClipIdParamSchema = z.object({ id: z.string().uuid() });
const RANGE_HEADER_RE = /bytes=(\d*)-(\d*)/;

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
    this.SendAttachment(clip.filePath, `clip-${clip.sequence}.mp4`, res, `Streaming clip ${id}`);
  }

  @Get(':id/stream')
  async Stream(@Param() params: unknown, @Req() req: Request, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.GetClip(id);
    await this.StreamVideoFile(clip.filePath, req, res, `Streaming clip ${id}`);
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

  @Post(':id/captions')
  async SetCaptions(@Param() params: unknown, @Body() body: unknown, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const dto = SetCaptionsSchema.parse(body);
    const clip = await this.clipsService.SetCaptions(id, dto);
    ApiResponse.Success(res, clip, 'Caption burn started', 202);
  }

  @Delete(':id/captions')
  @HttpCode(200)
  async ClearCaptions(@Param() params: unknown, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.ClearCaptions(id);
    ApiResponse.Success(res, clip, 'Captions cleared');
  }

  @Get(':id/captioned/download')
  async DownloadCaptioned(@Param() params: unknown, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.GetCaptionedClip(id);
    // GetCaptionedClip guarantees captionedFilePath is set when status is 'ready'.
    this.SendAttachment(clip.captionedFilePath as string, `clip-${clip.sequence}-captioned.mp4`, res, `Streaming captioned clip ${id}`);
  }

  @Get(':id/captioned/stream')
  async StreamCaptioned(@Param() params: unknown, @Req() req: Request, @Res() res: Response): Promise<void> {
    const { id } = ClipIdParamSchema.parse(params);
    const clip = await this.clipsService.GetCaptionedClip(id);
    await this.StreamVideoFile(clip.captionedFilePath as string, req, res, `Streaming captioned clip ${id}`);
  }

  private SendAttachment(filePath: string, downloadFilename: string, res: Response, errorContext: string): void {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    this.PipeToResponse(this.storage.ReadStream(filePath), res, errorContext);
  }

  /**
   * Inline playback for the browser's <video> element - unlike SendAttachment,
   * this never sets Content-Disposition: attachment (which some browsers
   * refuse to play inline) and supports HTTP Range requests so scrubbing
   * doesn't require re-downloading the whole clip.
   */
  private async StreamVideoFile(filePath: string, req: Request, res: Response, errorContext: string): Promise<void> {
    const fileSize = await this.storage.GetFileSize(filePath);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    const rangeHeader = req.headers.range;
    if (!rangeHeader) {
      res.setHeader('Content-Length', fileSize);
      this.PipeToResponse(this.storage.ReadStream(filePath), res, errorContext);
      return;
    }

    const match = RANGE_HEADER_RE.exec(rangeHeader);
    const start = match?.[1] ? Number.parseInt(match[1], 10) : 0;
    const end = match?.[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

    if (!match || Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', end - start + 1);
    this.PipeToResponse(this.storage.ReadStream(filePath, { start, end }), res, `${errorContext} range ${start}-${end}`);
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
