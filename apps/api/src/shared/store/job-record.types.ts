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

export type NewClipRecord = Omit<ClipRecord, 'id' | 'createdAt'>;
