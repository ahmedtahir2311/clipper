export const QUEUE_NAMES = {
  SOURCE_DOWNLOAD: 'source-download',
  CLIP_GENERATION: 'clip-generation',
  CLEANUP: 'storage-cleanup',
} as const;

export interface ClipGenerationJobData {
  jobId: string;
}

export interface SourceDownloadJobData {
  jobId: string;
  url: string;
}
