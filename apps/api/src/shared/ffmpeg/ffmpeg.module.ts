import { Module } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { SilenceDetectService } from './silence-detect.service';
import { VideoProbeService } from './video-probe.service';
import { VideoTransformService } from './video-transform.service';

@Module({
  providers: [FfmpegService, VideoProbeService, SilenceDetectService, VideoTransformService],
  exports: [FfmpegService, VideoProbeService, SilenceDetectService, VideoTransformService],
})
export class FfmpegModule {}
