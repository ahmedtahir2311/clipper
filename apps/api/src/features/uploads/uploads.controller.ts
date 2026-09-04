import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ImportFromUrlSchema, InitiateUploadSchema } from '@clipper/shared';
import { AuthGuard } from '../../shared/auth/auth.guard';
import { AppError, ErrorCodes } from '../../shared/errors/app-error';
import { ApiResponse } from '../../shared/utils/api-response.util';
import { UploadChunkParamsSchema, UploadIdParamSchema } from './dto/upload-chunk-params.schema';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('initiate')
  async Initiate(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const dto = InitiateUploadSchema.parse(body);
    const result = await this.uploadsService.InitiateUpload(dto);
    ApiResponse.Success(res, result, 'Upload initiated', 201);
  }

  @Post('from-url')
  async ImportFromUrl(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const dto = ImportFromUrlSchema.parse(body);
    const result = await this.uploadsService.ImportFromUrl(dto);
    ApiResponse.Success(res, result, 'Import started, downloading video', 201);
  }

  @Get(':uploadId/status')
  async GetStatus(@Param() params: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { uploadId } = UploadIdParamSchema.parse(params);
    const meta = await this.uploadsService.GetStatus(uploadId);
    ApiResponse.Success(res, meta, 'Upload status retrieved');
  }

  @Post(':uploadId/chunks/:chunkIndex')
  async WriteChunk(@Param() params: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { uploadId, chunkIndex } = UploadChunkParamsSchema.parse(params);

    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Chunk body must be raw binary data', 400);
    }

    const meta = await this.uploadsService.WriteChunk(uploadId, chunkIndex, req.body);
    ApiResponse.Success(res, meta, 'Chunk received');
  }

  @Post(':uploadId/complete')
  async Complete(@Param() params: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { uploadId } = UploadIdParamSchema.parse(params);
    const result = await this.uploadsService.CompleteUpload(uploadId);
    ApiResponse.Success(res, result, 'Upload complete, processing started', 201);
  }
}
