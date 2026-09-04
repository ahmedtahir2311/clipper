'use client';

import { useState } from 'react';
import type { ClipDto } from '@clipper/shared';
import { Button } from '@/components/atoms/button';
import { ClipPreviewModal } from '@/components/molecules/clip-preview-modal';
import { FormatDuration } from '@/lib/utils';
import { API_BASE_URL } from '@/config/constants';

export function ClipCard({ clip }: { clip: ClipDto }): JSX.Element {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsPreviewOpen(true)}
        className="group relative block aspect-[9/16] w-full bg-gray-900"
        aria-label={`Preview clip ${clip.sequence}`}
      >
        {clip.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_BASE_URL}${clip.thumbnailUrl}`} alt={`Clip ${clip.sequence} thumbnail`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">No preview</div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
            ▶
          </span>
        </div>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {FormatDuration(clip.durationSeconds)}
        </span>
      </button>
      <div className="flex items-center justify-between p-3">
        <span className="text-sm font-medium text-gray-700">Clip {clip.sequence}</span>
        <a href={`${API_BASE_URL}${clip.downloadUrl}`} download>
          <Button size="sm" variant="secondary">
            Download
          </Button>
        </a>
      </div>

      {isPreviewOpen && <ClipPreviewModal clip={clip} onClose={() => setIsPreviewOpen(false)} />}
    </div>
  );
}
