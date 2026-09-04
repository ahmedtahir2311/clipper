import type { CaptionSegment, CaptionStatus, CaptionStyle } from '@clipper/shared';

export type JobRecordStatus = 'pending' | 'downloading' | 'processing' | 'completed' | 'failed';

export interface ClipRecord {
  id: string;
  sequence: number;
  filePath: string;
  thumbnailPath: string | null;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  createdAt: string;
  captionStatus: CaptionStatus;
  captionStyle: CaptionStyle | null;
  captionSegments: CaptionSegment[] | null;
  /** Deterministic path (clips/clip-<sequence>-captioned.mp4); overwritten on each re-caption, so no orphan cleanup is needed. */
  captionedFilePath: string | null;
  captionError: string | null;
}

export interface JobRecord {
  id: string;
  status: JobRecordStatus;
  sourceFilename: string;
  sourcePath: string;
  sourceUrl: string | null;
  durationSeconds: number | null;
  progressCurrent: number;
  progressTotal: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  clips: ClipRecord[];
}

export type NewJobRecord = Pick<JobRecord, 'sourceFilename' | 'sourcePath'> &
  Partial<Pick<JobRecord, 'sourceUrl' | 'durationSeconds' | 'status'>>;

export type NewClipRecord = Omit<
  ClipRecord,
  'id' | 'createdAt' | 'captionStatus' | 'captionStyle' | 'captionSegments' | 'captionedFilePath' | 'captionError'
>;
