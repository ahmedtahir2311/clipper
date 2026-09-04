import type { ClipDto } from '@clipper/shared';
import type { ClipRecord } from '../store/job-record.types';

/** Shared between JobsService (clips embedded in a job) and the caption endpoints (a single clip) so the URL/shape logic lives in exactly one place. */
export function ToClipDto(jobId: string, clip: ClipRecord): ClipDto {
  return {
    id: clip.id,
    jobId,
    sequence: clip.sequence,
    startTime: clip.startTime,
    endTime: clip.endTime,
    durationSeconds: clip.durationSeconds,
    // Relative to the API base URL, which already includes the /api/v1
    // prefix on the frontend (see apps/web/src/config/constants.ts) - do
    // not prefix with /api/v1 here or clients double it up.
    downloadUrl: `/clips/${clip.id}/download`,
    streamUrl: `/clips/${clip.id}/stream`,
    thumbnailUrl: clip.thumbnailPath ? `/clips/${clip.id}/thumbnail` : null,
    createdAt: clip.createdAt,
    captionStatus: clip.captionStatus,
    captionStyle: clip.captionStyle,
    captionSegments: clip.captionSegments,
    captionError: clip.captionError,
    captionedDownloadUrl: clip.captionStatus === 'ready' ? `/clips/${clip.id}/captioned/download` : null,
    captionedStreamUrl: clip.captionStatus === 'ready' ? `/clips/${clip.id}/captioned/stream` : null,
  };
}
