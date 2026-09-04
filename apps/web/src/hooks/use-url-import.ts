import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadsService } from '@/services/uploads.service';

interface UrlImportState {
  isImporting: boolean;
  error: string | null;
}

export function UseUrlImport() {
  const router = useRouter();
  const [state, setState] = useState<UrlImportState>({ isImporting: false, error: null });

  const importFromUrl = useCallback(
    async (url: string) => {
      setState({ isImporting: true, error: null });
      try {
        const jobId = await UploadsService.ImportFromUrl(url);
        setState({ isImporting: false, error: null });
        router.push(`/jobs/${jobId}`);
      } catch (error) {
        setState({ isImporting: false, error: error instanceof Error ? error.message : 'Import failed' });
      }
    },
    [router]
  );

  return { ...state, importFromUrl };
}
