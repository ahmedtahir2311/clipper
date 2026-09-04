'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CaptionStyle, ClipDto } from '@clipper/shared';
import { CAPTION_STYLE_LABELS } from '@clipper/shared';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { ClipsService } from '@/services/clips.service';
import { cn } from '@/lib/utils';

interface CaptionEditorModalProps {
  clip: ClipDto;
  jobId: string;
  onClose: () => void;
}

interface SegmentInput {
  text: string;
  startTime: string;
  endTime: string;
}

const CAPTION_STYLES: CaptionStyle[] = ['simple', 'karaoke', 'highlighter-box'];

function DefaultSegment(clip: ClipDto): SegmentInput {
  return { text: '', startTime: '0', endTime: String(Math.min(3, clip.durationSeconds)) };
}

export function CaptionEditorModal({ clip, jobId, onClose }: CaptionEditorModalProps): JSX.Element {
  const queryClient = useQueryClient();
  const [style, setStyle] = useState<CaptionStyle>(clip.captionStyle ?? 'simple');
  const [segments, setSegments] = useState<SegmentInput[]>(
    clip.captionSegments && clip.captionSegments.length > 0
      ? clip.captionSegments.map((s) => ({ text: s.text, startTime: String(s.startTime), endTime: String(s.endTime) }))
      : [DefaultSegment(clip)]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSegment(index: number, patch: Partial<SegmentInput>): void {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSegment(): void {
    const last = segments[segments.length - 1];
    const lastEnd = Number(last?.endTime ?? 0);
    const nextEnd = Math.min(lastEnd + 3, clip.durationSeconds);
    setSegments((prev) => [...prev, { text: '', startTime: String(lastEnd), endTime: String(nextEnd) }]);
  }

  function removeSegment(index: number): void {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const parsedSegments = segments.map((s) => ({
      text: s.text.trim(),
      startTime: Number(s.startTime),
      endTime: Number(s.endTime),
    }));

    if (parsedSegments.some((s) => !s.text)) {
      setError('Every caption line needs text.');
      return;
    }
    if (parsedSegments.some((s) => !Number.isFinite(s.startTime) || !Number.isFinite(s.endTime) || s.endTime <= s.startTime)) {
      setError('Each line needs a valid start/end time, with end after start.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ClipsService.SetCaptions(clip.id, { style, segments: parsedSegments });
      await queryClient.invalidateQueries({ queryKey: ['jobs', jobId] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start caption burn');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add captions - Clip {clip.sequence}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Style</p>
            <div className="flex gap-2">
              {CAPTION_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    style === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {CAPTION_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              Caption lines - clip is {clip.durationSeconds.toFixed(1)}s long, times are in seconds
            </p>
            <div className="space-y-2">
              {segments.map((segment, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input
                    placeholder="Caption text"
                    value={segment.text}
                    onChange={(e) => updateSegment(index, { text: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={segment.startTime}
                    onChange={(e) => updateSegment(index, { startTime: e.target.value })}
                    className="w-20"
                    aria-label="Start time (seconds)"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={segment.endTime}
                    onChange={(e) => updateSegment(index, { endTime: e.target.value })}
                    className="w-20"
                    aria-label="End time (seconds)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSegment(index)}
                    disabled={segments.length === 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addSegment} className="mt-2">
              + Add line
            </Button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Starting...' : 'Burn captions'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
