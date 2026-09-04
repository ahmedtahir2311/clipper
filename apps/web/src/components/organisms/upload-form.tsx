'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UploadDropzone } from '@/components/molecules/upload-dropzone';
import { UrlImportForm } from '@/components/molecules/url-import-form';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { Button } from '@/components/atoms/button';
import { UseUpload } from '@/hooks/use-upload';
import { FormatBytes } from '@/lib/utils';

type UploadSource = 'file' | 'url';

export function UploadForm(): JSX.Element {
  const [source, setSource] = useState<UploadSource>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isUploading, progressPercent, error, upload } = UseUpload();

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium">
        {(['file', 'url'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSource(tab)}
            className={cn(
              'flex-1 rounded-md py-1.5 transition-colors',
              source === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab === 'file' ? 'Upload file' : 'Import from YouTube'}
          </button>
        ))}
      </div>

      {source === 'file' ? (
        <>
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
        </>
      ) : (
        <UrlImportForm />
      )}
    </div>
  );
}
