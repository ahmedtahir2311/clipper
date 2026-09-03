import { Injectable, Logger } from '@nestjs/common';
import { FfmpegService } from './ffmpeg.service';
import { VideoProbeService } from './video-probe.service';

const VERTICAL_WIDTH = 1080;
const VERTICAL_HEIGHT = 1920;
/** How far a `-c copy` trim's actual output duration may drift from the requested duration before it is considered "missed the keyframe" and re-encoded instead. */
const COPY_DURATION_TOLERANCE_SECONDS = 0.75;

export interface TrimResult {
  usedFastCopy: boolean;
}

@Injectable()
export class VideoTransformService {
  private readonly logger = new Logger(VideoTransformService.name);

  constructor(
    private readonly ffmpegService: FfmpegService,
    private readonly videoProbeService: VideoProbeService
  ) {}

  /**
   * Trims [startTime, endTime) out of the source into its own file.
   * Tries the fast `-c copy` path first (no re-encode, only possible when
   * both boundaries land on/near keyframes); if the resulting segment's
   * duration drifts too far from what was requested - meaning ffmpeg
   * snapped to the nearest keyframe instead of the exact point - it is
   * discarded and redone with a re-encoding trim, which can cut anywhere.
   */
  async TrimSegment(sourcePath: string, outputPath: string, startTime: number, endTime: number): Promise<TrimResult> {
    const requestedDuration = endTime - startTime;

    await this.ffmpegService.RunFfmpeg([
      '-y',
      '-ss',
      startTime.toFixed(3),
      '-i',
      sourcePath,
      '-t',
      requestedDuration.toFixed(3),
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
      outputPath,
    ]);

    const probe = await this.videoProbeService.Probe(outputPath).catch(() => null);
    const driftSeconds = probe ? Math.abs(probe.durationSeconds - requestedDuration) : Number.POSITIVE_INFINITY;

    if (probe && driftSeconds <= COPY_DURATION_TOLERANCE_SECONDS) {
      this.logger.log(`Fast -c copy trim OK for ${outputPath} (drift ${driftSeconds.toFixed(3)}s)`);
      return { usedFastCopy: true };
    }

    this.logger.log(`Fast copy trim missed keyframe for ${outputPath} (drift ${driftSeconds.toFixed(3)}s) - re-encoding trim`);

    await this.ffmpegService.RunFfmpeg([
      '-y',
      '-ss',
      startTime.toFixed(3),
      '-i',
      sourcePath,
      '-t',
      requestedDuration.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      outputPath,
    ]);

    return { usedFastCopy: false };
  }

  /**
   * Reframes an already-trimmed clip to 9:16. Landscape sources are
   * center-cropped to vertical; vertical/near-square sources are scaled to
   * fit and letterboxed. This step always re-encodes (filters require it)
   * but runs against the short trimmed clip rather than the full source.
   */
  async ReframeToVertical(inputPath: string, outputPath: string, sourceWidth: number, sourceHeight: number): Promise<void> {
    const reframeFilter = this.BuildReframeFilter(sourceWidth, sourceHeight);

    await this.ffmpegService.RunFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-vf',
      reframeFilter,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  }

  async GenerateThumbnail(clipPath: string, outputPath: string, atSecond = 0.5): Promise<void> {
    await this.ffmpegService.RunFfmpeg(['-y', '-ss', atSecond.toFixed(3), '-i', clipPath, '-frames:v', '1', '-q:v', '3', outputPath]);
  }

  private BuildReframeFilter(sourceWidth: number, sourceHeight: number): string {
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = VERTICAL_WIDTH / VERTICAL_HEIGHT;

    if (sourceAspect > targetAspect) {
      return `crop=ih*${targetAspect}:ih:(iw-ih*${targetAspect})/2:0,scale=${VERTICAL_WIDTH}:${VERTICAL_HEIGHT}`;
    }

    return `scale=${VERTICAL_WIDTH}:${VERTICAL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VERTICAL_WIDTH}:${VERTICAL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`;
  }
}
