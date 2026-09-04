import { z } from 'zod';

export const JobStatusSchema = z.enum(['pending', 'downloading', 'processing', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const ClipDtoSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  sequence: z.number().int(),
  startTime: z.number(),
  endTime: z.number(),
  durationSeconds: z.number(),
  downloadUrl: z.string(),
  streamUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type ClipDto = z.infer<typeof ClipDtoSchema>;

export const JobDtoSchema = z.object({
  id: z.string().uuid(),
  status: JobStatusSchema,
  sourceFilename: z.string(),
  durationSeconds: z.number().nullable(),
  progress: z.object({
    current: z.number().int(),
    total: z.number().int(),
    label: z.string(),
  }),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  clips: z.array(ClipDtoSchema).optional(),
});
export type JobDto = z.infer<typeof JobDtoSchema>;

export const InitiateUploadSchema = z.object({
  filename: z.string().min(1).max(512),
  fileSizeBytes: z.number().int().positive(),
  mimeType: z.enum(['video/mp4', 'video/quicktime', 'video/x-matroska']),
  totalChunks: z.number().int().positive(),
});
export type InitiateUploadDto = z.infer<typeof InitiateUploadSchema>;

export const UploadChunkParamsSchema = z.object({
  uploadId: z.string().uuid(),
});

export const UploadChunkQuerySchema = z.object({
  chunkIndex: z.coerce.number().int().min(0),
});

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);

export const ImportFromUrlSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (value) => {
        try {
          return YOUTUBE_HOSTS.has(new URL(value).hostname.toLowerCase());
        } catch {
          return false;
        }
      },
      { message: 'Only youtube.com / youtu.be links are supported' }
    ),
});
export type ImportFromUrlDto = z.infer<typeof ImportFromUrlSchema>;
