'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ACCEPTED_VIDEO_MIME_TYPES } from '@/config/constants';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFileSelected, disabled }: UploadDropzoneProps): JSX.Element {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  return (
    <div
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors',
        isDragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300',
        disabled && 'pointer-events-none opacity-50'
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <p className="text-sm font-medium text-gray-700">Drag and drop your video here, or click to browse</p>
      <p className="mt-1 text-xs text-gray-500">MP4, MOV, or MKV up to 2GB</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_MIME_TYPES.join(',')}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
