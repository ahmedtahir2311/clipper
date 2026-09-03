import { Module } from '@nestjs/common';
import { FfmpegModule } from '../../shared/ffmpeg/ffmpeg.module';
import { ProcessingModule } from '../processing/processing.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [FfmpegModule, ProcessingModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
