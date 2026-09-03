import { z } from 'zod';

export const UploadChunkParamsSchema = z.object({
  uploadId: z.string().uuid(),
  chunkIndex: z.coerce.number().int().min(0),
});
export type UploadChunkParamsDto = z.infer<typeof UploadChunkParamsSchema>;

export const UploadIdParamSchema = z.object({
  uploadId: z.string().uuid(),
});
