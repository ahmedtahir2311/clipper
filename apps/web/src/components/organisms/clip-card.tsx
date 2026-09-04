'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ClipDto } from '@clipper/shared';
import { Button } from '@/components/atoms/button';
import { ClipPreviewModal } from '@/components/molecules/clip-preview-modal';
import { CaptionEditorModal } from '@/components/organisms/caption-editor-modal';
import { ClipsService } from '@/services/clips.service';
import { FormatDuration } from '@/lib/utils';
import { API_BASE_URL } from '@/config/constants';

export function ClipCard({ clip }: { clip: ClipDto }): JSX.Element {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{ streamUrl: string; label: string } | null>(null);
  const [isEditingCaptions, setIsEditingCaptions] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  async function handleClearCaptions(): Promise<void> {
    setIsClearing(true);
    try {
      await ClipsService.ClearCaptions(clip.id);
      await queryClient.invalidateQueries({ queryKey: ['jobs', clip.jobId] });
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setPreview({ streamUrl: clip.streamUrl, label: `Preview of clip ${clip.sequence}` })}
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

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Clip {clip.sequence}</span>
          <a href={`${API_BASE_URL}${clip.downloadUrl}`} download>
            <Button size="sm" variant="secondary">
              Download
            </Button>
          </a>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
          {clip.captionStatus === 'none' && (
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setIsEditingCaptions(true)}>
              + Add captions
            </Button>
          )}

          {clip.captionStatus === 'pending' && (
            <span className="flex w-full items-center justify-center gap-1.5 text-xs text-gray-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              Burning captions...
            </span>
          )}

          {clip.captionStatus === 'ready' && clip.captionedStreamUrl && clip.captionedDownloadUrl && (
            <div className="flex w-full items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setPreview({ streamUrl: clip.captionedStreamUrl!, label: `Captioned preview of clip ${clip.sequence}` })}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                ✓ Preview captioned
              </button>
              <div className="flex gap-1">
                <a href={`${API_BASE_URL}${clip.captionedDownloadUrl}`} download>
                  <Button size="sm" variant="secondary">
                    Download
                  </Button>
                </a>
                <Button size="sm" variant="ghost" onClick={handleClearCaptions} disabled={isClearing}>
                  Remove
                </Button>
              </div>
            </div>
          )}

          {clip.captionStatus === 'failed' && (
            <div className="w-full">
              <p className="text-xs text-red-500">Caption burn failed{clip.captionError ? `: ${clip.captionError}` : ''}</p>
              <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setIsEditingCaptions(true)}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>

      {preview && <ClipPreviewModal streamUrl={preview.streamUrl} label={preview.label} onClose={() => setPreview(null)} />}
      {isEditingCaptions && <CaptionEditorModal clip={clip} jobId={clip.jobId} onClose={() => setIsEditingCaptions(false)} />}
    </div>
  );
}
