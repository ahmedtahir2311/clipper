import { Injectable } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { ParseSilenceDetectOutput, type SilenceInterval } from './silence-detect.util';

@Injectable()
export class SilenceDetectService {
  constructor(private readonly ffmpegService: FfmpegService) {}

  async Detect(absolutePath: string, noiseDb: number, minDurationSeconds: number, totalDurationSeconds: number): Promise<SilenceInterval[]> {
    const { stderr } = await this.ffmpegService.RunFfmpeg([
      '-i',
      absolutePath,
      '-af',
      `silencedetect=noise=${noiseDb}dB:d=${minDurationSeconds}`,
      '-f',
      'null',
      '-',
    ]);

    return ParseSilenceDetectOutput(stderr, totalDurationSeconds);
  }
}
