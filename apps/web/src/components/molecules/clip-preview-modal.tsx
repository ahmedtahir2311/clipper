'use client';

import { useEffect } from 'react';
import type { ClipDto } from '@clipper/shared';
import { API_BASE_URL } from '@/config/constants';

interface ClipPreviewModalProps {
  clip: ClipDto;
  onClose: () => void;
}

export function ClipPreviewModal({ clip, onClose }: ClipPreviewModalProps): JSX.Element {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of clip ${clip.sequence}`}
    >
      <div className="relative max-h-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-sm font-medium text-white/80 hover:text-white"
        >
          Close ✕
        </button>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={`${API_BASE_URL}${clip.streamUrl}`}
          controls
          autoPlay
          className="max-h-[85vh] w-full rounded-lg bg-black"
        />
      </div>
    </div>
  );
}
