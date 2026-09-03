export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const UPLOAD_CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per chunk

export const ACCEPTED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska'] as const;

export const JOB_POLL_INTERVAL_MS = 3000;
