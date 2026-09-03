import { Controller, Delete, Get, HttpCode, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../../shared/auth/auth.guard';
import { ApiResponse } from '../../shared/utils/api-response.util';
import { JobIdParamSchema } from './dto/job-id-param.schema';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async List(@Res({ passthrough: true }) res: Response): Promise<void> {
    const list = await this.jobsService.ListJobs();
    ApiResponse.Success(res, list, 'Jobs retrieved');
  }

  @Get(':id')
  async GetOne(@Param() params: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { id } = JobIdParamSchema.parse(params);
    const job = await this.jobsService.GetJob(id);
    ApiResponse.Success(res, job, 'Job retrieved');
  }

  @Get(':id/download-all')
  async DownloadAll(@Param() params: unknown, @Res() res: Response): Promise<void> {
    const { id } = JobIdParamSchema.parse(params);
    await this.jobsService.StreamAllClipsAsZip(id, res);
  }

  @Delete(':id')
  @HttpCode(200)
  async Delete(@Param() params: unknown, @Res({ passthrough: true }) res: Response): Promise<void> {
    const { id } = JobIdParamSchema.parse(params);
    await this.jobsService.DeleteJob(id);
    ApiResponse.Success(res, null, 'Job deleted');
  }
}
