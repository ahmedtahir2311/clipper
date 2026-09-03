export const QUEUE_NAMES = {
  CLIP_GENERATION: 'clip-generation',
  CLEANUP: 'storage-cleanup',
} as const;

export interface ClipGenerationJobData {
  jobId: string;
}
