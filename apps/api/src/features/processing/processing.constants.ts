export const QUEUE_NAMES = {
  SOURCE_DOWNLOAD: 'source-download',
  CLIP_GENERATION: 'clip-generation',
  CAPTION_BURN: 'caption-burn',
  CLEANUP: 'storage-cleanup',
} as const;

export interface ClipGenerationJobData {
  jobId: string;
}

export interface SourceDownloadJobData {
  jobId: string;
  url: string;
}

export interface CaptionBurnJobData {
  clipId: string;
}
