import type { ClipDto } from '@clipper/shared';
import { Button } from '@/components/atoms/button';
import { FormatDuration } from '@/lib/utils';
import { API_BASE_URL } from '@/config/constants';

export function ClipCard({ clip }: { clip: ClipDto }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-[9/16] bg-gray-900">
        {clip.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${API_BASE_URL}${clip.thumbnailUrl}`} alt={`Clip ${clip.sequence} thumbnail`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">No preview</div>
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          {FormatDuration(clip.durationSeconds)}
        </span>
      </div>
      <div className="flex items-center justify-between p-3">
        <span className="text-sm font-medium text-gray-700">Clip {clip.sequence}</span>
        <a href={`${API_BASE_URL}${clip.downloadUrl}`} download>
          <Button size="sm" variant="secondary">
            Download
          </Button>
        </a>
      </div>
    </div>
  );
}
