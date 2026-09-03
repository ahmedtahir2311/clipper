'use client';

import { useState } from 'react';
import { UploadDropzone } from '@/components/molecules/upload-dropzone';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { Button } from '@/components/atoms/button';
import { UseUpload } from '@/hooks/use-upload';
import { FormatBytes } from '@/lib/utils';

export function UploadForm(): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isUploading, progressPercent, error, upload } = UseUpload();

  return (
    <div className="space-y-4">
      <UploadDropzone onFileSelected={setSelectedFile} disabled={isUploading} />

      {selectedFile && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{FormatBytes(selectedFile.size)}</p>
            </div>
            <Button onClick={() => upload(selectedFile)} disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload & Generate Clips'}
            </Button>
          </div>
          {isUploading && (
            <div className="mt-3">
              <ProgressBar percent={progressPercent} />
              <p className="mt-1 text-xs text-gray-500">{progressPercent}%</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
