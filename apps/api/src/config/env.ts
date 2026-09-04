import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000'),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD_HASH: z.string().min(1, 'ADMIN_PASSWORD_HASH is required'),

  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_ROOT: z.string().default('./storage'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024 * 1024),

  CLIP_MIN_DURATION_SECONDS: z.coerce.number().positive().default(15),
  CLIP_MAX_DURATION_SECONDS: z.coerce.number().positive().default(60),
  CLIP_TARGET_COUNT_MIN: z.coerce.number().int().positive().default(7),
  CLIP_TARGET_COUNT_MAX: z.coerce.number().int().positive().default(10),

  SILENCE_NOISE_DB: z.coerce.number().default(-30),
  SILENCE_MIN_DURATION_SECONDS: z.coerce.number().positive().default(0.5),
  SILENCE_SNAP_WINDOW_SECONDS: z.coerce.number().positive().default(5),

  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  FFMPEG_TIMEOUT_MS: z.coerce.number().int().positive().default(600_000),

  CLEANUP_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  CLEANUP_CRON: z.string().default('0 3 * * *'),

  YT_DLP_PATH: z.string().default('yt-dlp'),
  YT_DLP_METADATA_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  YT_DLP_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),
  YOUTUBE_IMPORT_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(7200),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function ValidateEnv(config: Record<string, unknown>): EnvConfig {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
