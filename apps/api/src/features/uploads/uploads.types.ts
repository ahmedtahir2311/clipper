export interface UploadMeta {
  uploadId: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  totalChunks: number;
  nextExpectedChunkIndex: number;
  bytesReceived: number;
}

export const MIME_TO_EXTENSION: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
};
