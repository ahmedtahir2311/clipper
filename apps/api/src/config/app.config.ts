import { registerAs } from '@nestjs/config';
import type { EnvConfig } from './env';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.API_PORT ?? 3001),
  corsOrigin: process.env.API_CORS_ORIGIN ?? 'http://localhost:3000',
}));

export const storageConfig = registerAs('storage', () => ({
  driver: (process.env.STORAGE_DRIVER ?? 'local') as EnvConfig['STORAGE_DRIVER'],
  root: process.env.STORAGE_ROOT ?? './storage',
  maxUploadBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 2 * 1024 * 1024 * 1024),
}));

export const clipConfig = registerAs('clip', () => ({
  minDurationSeconds: Number(process.env.CLIP_MIN_DURATION_SECONDS ?? 15),
  maxDurationSeconds: Number(process.env.CLIP_MAX_DURATION_SECONDS ?? 60),
  targetCountMin: Number(process.env.CLIP_TARGET_COUNT_MIN ?? 7),
  targetCountMax: Number(process.env.CLIP_TARGET_COUNT_MAX ?? 10),
  silenceNoiseDb: Number(process.env.SILENCE_NOISE_DB ?? -30),
  silenceMinDurationSeconds: Number(process.env.SILENCE_MIN_DURATION_SECONDS ?? 0.5),
  silenceSnapWindowSeconds: Number(process.env.SILENCE_SNAP_WINDOW_SECONDS ?? 5),
}));

export const ffmpegConfig = registerAs('ffmpeg', () => ({
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH ?? 'ffprobe',
  timeoutMs: Number(process.env.FFMPEG_TIMEOUT_MS ?? 600_000),
}));

export const authConfig = registerAs('auth', () => ({
  sessionSecret: process.env.SESSION_SECRET ?? '',
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? '',
}));

export const cleanupConfig = registerAs('cleanup', () => ({
  retentionDays: Number(process.env.CLEANUP_RETENTION_DAYS ?? 7),
  cron: process.env.CLEANUP_CRON ?? '0 3 * * *',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
}));

export const youtubeImportConfig = registerAs('youtubeImport', () => ({
  ytDlpPath: process.env.YT_DLP_PATH ?? 'yt-dlp',
  metadataTimeoutMs: Number(process.env.YT_DLP_METADATA_TIMEOUT_MS ?? 20_000),
  downloadTimeoutMs: Number(process.env.YT_DLP_DOWNLOAD_TIMEOUT_MS ?? 1_800_000),
  maxDurationSeconds: Number(process.env.YOUTUBE_IMPORT_MAX_DURATION_SECONDS ?? 7200),
}));
