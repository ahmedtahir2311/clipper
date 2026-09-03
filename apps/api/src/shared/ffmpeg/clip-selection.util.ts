import type { SilenceInterval } from './silence-detect.util';

export interface ClipSelectionConfig {
  minClipDurationSeconds: number;
  maxClipDurationSeconds: number;
  targetClipCountMin: number;
  targetClipCountMax: number;
  snapWindowSeconds: number;
}

export interface ClipWindow {
  startTime: number;
  endTime: number;
}

function ClampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Finds the closest silence-interval boundary (start or end) to `point`
 * within `snapWindowSeconds`. Returns null when nothing is close enough,
 * which is the "no detectable silence" fallback path - callers keep the
 * original fixed-interval cut point in that case.
 */
export function SnapToNearestSilenceBoundary(
  point: number,
  silenceIntervals: SilenceInterval[],
  snapWindowSeconds: number
): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;

  for (const interval of silenceIntervals) {
    for (const candidate of [interval.start, interval.end]) {
      const distance = Math.abs(candidate - point);
      if (distance <= snapWindowSeconds && distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  }

  return best;
}

/**
 * Chooses 7-10 (configurable) non-overlapping clip windows spanning a
 * source video, snapping interior cut points to the nearest detected
 * silence boundary. Pure function - no I/O - so it is unit-testable in
 * isolation from ffmpeg.
 *
 * Strategy:
 * 1. Pick a clip count that keeps average clip length within
 *    [minClipDurationSeconds, maxClipDurationSeconds], clamped to
 *    [targetClipCountMin, targetClipCountMax] and to what the video's
 *    duration can actually support.
 * 2. Lay down evenly-spaced fixed-interval boundaries for that count.
 * 3. Snap each interior boundary to the nearest silence interval edge
 *    within snapWindowSeconds. If snapping would push a clip's duration
 *    outside the configured bounds (or invert ordering), that boundary
 *    falls back to its fixed-interval position - this is also what
 *    happens automatically when no silence was detected at all.
 */
export function SelectClipWindows(
  totalDurationSeconds: number,
  silenceIntervals: SilenceInterval[],
  config: ClipSelectionConfig
): ClipWindow[] {
  if (totalDurationSeconds <= 0) {
    return [];
  }

  const { minClipDurationSeconds, maxClipDurationSeconds, targetClipCountMin, targetClipCountMax, snapWindowSeconds } = config;

  const averageDesiredLength = (minClipDurationSeconds + maxClipDurationSeconds) / 2;
  const countFromDuration = Math.floor(totalDurationSeconds / averageDesiredLength);
  const desiredCount = ClampNumber(countFromDuration, targetClipCountMin, targetClipCountMax);
  const maxPossibleByMinDuration = Math.max(1, Math.floor(totalDurationSeconds / minClipDurationSeconds));
  const finalCount = Math.max(1, Math.min(desiredCount, maxPossibleByMinDuration));

  const idealClipLength = ClampNumber(totalDurationSeconds / finalCount, minClipDurationSeconds, maxClipDurationSeconds);

  const rawBoundaries: number[] = [];
  for (let i = 0; i <= finalCount; i += 1) {
    rawBoundaries.push(Math.min(i * idealClipLength, totalDurationSeconds));
  }
  rawBoundaries[rawBoundaries.length - 1] = totalDurationSeconds;

  const snappedBoundaries = rawBoundaries.map((boundary, index) => {
    const isEndpoint = index === 0 || index === rawBoundaries.length - 1;
    if (isEndpoint) {
      return boundary;
    }
    return SnapToNearestSilenceBoundary(boundary, silenceIntervals, snapWindowSeconds) ?? boundary;
  });

  const windows: ClipWindow[] = [];
  for (let i = 0; i < snappedBoundaries.length - 1; i += 1) {
    let start = snappedBoundaries[i];
    let end = snappedBoundaries[i + 1];
    const duration = end - start;

    const isInvalidOrder = end <= start;
    const isOutOfBounds = duration < minClipDurationSeconds - 0.001 || duration > maxClipDurationSeconds + 0.001;

    if (isInvalidOrder || isOutOfBounds) {
      start = rawBoundaries[i];
      end = rawBoundaries[i + 1];
    }

    windows.push({
      startTime: Number(start.toFixed(3)),
      endTime: Number(end.toFixed(3)),
    });
  }

  return windows;
}
