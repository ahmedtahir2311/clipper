import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadsService } from '@/services/uploads.service';

interface UploadState {
  isUploading: boolean;
  progressPercent: number;
  error: string | null;
}

export function UseUpload() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ isUploading: false, progressPercent: 0, error: null });

  const upload = useCallback(
    async (file: File) => {
      setState({ isUploading: true, progressPercent: 0, error: null });
      try {
        const jobId = await UploadsService.UploadFile(file, ({ chunkIndex, totalChunks }) => {
          setState((prev) => ({ ...prev, progressPercent: Math.round((chunkIndex / totalChunks) * 100) }));
        });
        setState({ isUploading: false, progressPercent: 100, error: null });
        router.push(`/jobs/${jobId}`);
      } catch (error) {
        setState({ isUploading: false, progressPercent: 0, error: error instanceof Error ? error.message : 'Upload failed' });
      }
    },
    [router]
  );

  return { ...state, upload };
}
