import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { AppError, ErrorCodes } from '../errors/app-error';

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

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
    return this.RunProcess(this.ffmpegPath, args, timeoutMsOverride ?? this.timeoutMs);
  }

  async RunFfprobe(args: string[], timeoutMsOverride?: number): Promise<ProcessResult> {
    return this.RunProcess(this.ffprobePath, args, timeoutMsOverride ?? this.timeoutMs);
  }

  private RunProcess(command: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
    const invocation = `${command} ${args.join(' ')}`;

    return new Promise((resolvePromise, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        this.logger.error(`Timed out after ${timeoutMs}ms, killing process: ${invocation}`);
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        this.logger.error(`Failed to spawn: ${invocation} - ${error.message}`);
        reject(new AppError(ErrorCodes.FFMPEG_FAILED, `Failed to start ${command}: ${error.message}`, 500));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const exitCode = code ?? -1;
        this.logger.log(`[exit ${exitCode}] ${invocation}`);

        if (timedOut) {
          reject(new AppError(ErrorCodes.FFMPEG_FAILED, `${command} timed out after ${timeoutMs}ms`, 500));
          return;
        }

        if (exitCode !== 0) {
          this.logger.error(`stderr for failed invocation: ${stderr.slice(-2000)}`);
          reject(new AppError(ErrorCodes.FFMPEG_FAILED, `${command} exited with code ${exitCode}`, 500));
          return;
        }

        resolvePromise({ stdout, stderr, exitCode });
      });
    });
  }
}
