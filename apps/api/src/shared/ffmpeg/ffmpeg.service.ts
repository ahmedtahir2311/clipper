import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunProcess, type ProcessResult } from '../process/run-process.util';

export type { ProcessResult };

/**
 * Thin wrapper around ffmpeg/ffprobe child processes.
 *
 * Every invocation is time-bounded: a malformed or pathological source video
 * must not be able to hang a BullMQ worker forever. Exit codes and the
 * command line are always logged so cut-quality issues can be traced back to
 * the exact ffmpeg invocation that produced them.
 */
@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor(private readonly configService: ConfigService) {}

  private get ffmpegPath(): string {
    return this.configService.get<string>('ffmpeg.ffmpegPath', 'ffmpeg');
  }

  private get ffprobePath(): string {
    return this.configService.get<string>('ffmpeg.ffprobePath', 'ffprobe');
  }

  private get timeoutMs(): number {
    return this.configService.get<number>('ffmpeg.timeoutMs', 600_000);
  }

  async RunFfmpeg(args: string[], timeoutMsOverride?: number): Promise<ProcessResult> {
    return RunProcess(this.ffmpegPath, args, timeoutMsOverride ?? this.timeoutMs, this.logger);
  }

  async RunFfprobe(args: string[], timeoutMsOverride?: number): Promise<ProcessResult> {
    return RunProcess(this.ffprobePath, args, timeoutMsOverride ?? this.timeoutMs, this.logger);
  }
}
