import { Injectable } from '@nestjs/common';
import { AppError, ErrorCodes } from '../errors/app-error';
import { FfmpegService } from './ffmpeg.service';

export interface VideoProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
}

interface FfprobeStream {
  width?: number;
  height?: number;
  codec_type?: string;
}

interface FfprobeOutput {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

@Injectable()
export class VideoProbeService {
  constructor(private readonly ffmpegService: FfmpegService) {}

  async Probe(absolutePath: string): Promise<VideoProbeResult> {
    const { stdout } = await this.ffmpegService.RunFfprobe([
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      absolutePath,
    ]);

    let parsed: FfprobeOutput;
    try {
      parsed = JSON.parse(stdout) as FfprobeOutput;
    } catch {
      throw new AppError(ErrorCodes.FFMPEG_FAILED, 'Could not parse ffprobe output', 500);
    }

    const durationSeconds = Number.parseFloat(parsed.format?.duration ?? '');
    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');

    if (!Number.isFinite(durationSeconds) || !videoStream?.width || !videoStream?.height) {
      throw new AppError(ErrorCodes.UNSUPPORTED_FORMAT, 'Could not determine video duration/dimensions', 422);
    }

    return { durationSeconds, width: videoStream.width, height: videoStream.height };
  }
}
