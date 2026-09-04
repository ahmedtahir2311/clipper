import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError, ErrorCodes } from '../errors/app-error';
import { RunProcess } from '../process/run-process.util';

export interface YoutubeMetadata {
  id: string;
  title: string;
  durationSeconds: number;
  isLive: boolean;
}

interface YtDlpJsonOutput {
  id?: string;
  title?: string;
  duration?: number;
  is_live?: boolean;
}

/** Video/format selection: mp4 up to 1080p, falling back to whatever best format is available. Keeps downloads reasonably sized and avoids formats ffmpeg can't read later. */
const FORMAT_SELECTOR = 'bv*[ext=mp4][height<=1080]+ba[ext=m4a]/b[ext=mp4]/best';

@Injectable()
export class YtDlpService {
  private readonly logger = new Logger(YtDlpService.name);

  constructor(private readonly configService: ConfigService) {}

  private get ytDlpPath(): string {
    return this.configService.get<string>('youtubeImport.ytDlpPath', 'yt-dlp');
  }

  async FetchMetadata(url: string): Promise<YoutubeMetadata> {
    const timeoutMs = this.configService.get<number>('youtubeImport.metadataTimeoutMs', 20_000);

    let result;
    try {
      result = await RunProcess(this.ytDlpPath, ['--dump-single-json', '--no-warnings', '--no-playlist', '--skip-download', url], timeoutMs, this.logger);
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to fetch video metadata';
      throw new AppError(ErrorCodes.YOUTUBE_IMPORT_FAILED, `Could not read metadata for ${url}: ${message}`, 422);
    }

    let parsed: YtDlpJsonOutput;
    try {
      parsed = JSON.parse(result.stdout) as YtDlpJsonOutput;
    } catch {
      throw new AppError(ErrorCodes.YOUTUBE_IMPORT_FAILED, 'Could not parse yt-dlp metadata output', 500);
    }

    if (!parsed.id || !parsed.title || typeof parsed.duration !== 'number') {
      throw new AppError(ErrorCodes.YOUTUBE_IMPORT_FAILED, 'Video metadata is missing required fields (id/title/duration)', 422);
    }

    return {
      id: parsed.id,
      title: parsed.title,
      durationSeconds: parsed.duration,
      isLive: parsed.is_live ?? false,
    };
  }

  async DownloadVideo(url: string, absoluteOutputPath: string): Promise<void> {
    const timeoutMs = this.configService.get<number>('youtubeImport.downloadTimeoutMs', 1_800_000);

    try {
      await RunProcess(
        this.ytDlpPath,
        ['-f', FORMAT_SELECTOR, '--merge-output-format', 'mp4', '--no-playlist', '--no-warnings', '-o', absoluteOutputPath, url],
        timeoutMs,
        this.logger
      );
    } catch (error) {
      const message = error instanceof AppError ? error.message : 'Failed to download video';
      throw new AppError(ErrorCodes.YOUTUBE_IMPORT_FAILED, `Download failed for ${url}: ${message}`, 502);
    }
  }
}
