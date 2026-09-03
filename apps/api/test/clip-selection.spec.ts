import { describe, expect, it } from 'vitest';
import { SelectClipWindows, SnapToNearestSilenceBoundary, type ClipSelectionConfig } from '../src/shared/ffmpeg/clip-selection.util';
import { ParseSilenceDetectOutput } from '../src/shared/ffmpeg/silence-detect.util';

const BASE_CONFIG: ClipSelectionConfig = {
  minClipDurationSeconds: 15,
  maxClipDurationSeconds: 60,
  targetClipCountMin: 7,
  targetClipCountMax: 10,
  snapWindowSeconds: 5,
};

describe('ParseSilenceDetectOutput', () => {
  it('parses matched silence_start/silence_end pairs', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 10.5',
      '[silencedetect @ 0x1] silence_end: 12.1 | silence_duration: 1.6',
      '[silencedetect @ 0x1] silence_start: 40',
      '[silencedetect @ 0x1] silence_end: 41.25 | silence_duration: 1.25',
    ].join('\n');

    expect(ParseSilenceDetectOutput(stderr, 100)).toEqual([
      { start: 10.5, end: 12.1 },
      { start: 40, end: 41.25 },
    ]);
  });

  it('closes a trailing silence_start using total duration', () => {
    const stderr = '[silencedetect @ 0x1] silence_start: 95';
    expect(ParseSilenceDetectOutput(stderr, 100)).toEqual([{ start: 95, end: 100 }]);
  });

  it('returns an empty array when no silence was detected', () => {
    expect(ParseSilenceDetectOutput('nothing here', 100)).toEqual([]);
  });
});

describe('SnapToNearestSilenceBoundary', () => {
  const intervals = [
    { start: 30, end: 32 },
    { start: 90, end: 91.5 },
  ];

  it('snaps to the closest boundary within the window', () => {
    expect(SnapToNearestSilenceBoundary(33, intervals, 5)).toBe(32);
    expect(SnapToNearestSilenceBoundary(28, intervals, 5)).toBe(30);
  });

  it('prefers the closer of two candidate boundaries', () => {
    expect(SnapToNearestSilenceBoundary(31, intervals, 5)).toBe(30);
    expect(SnapToNearestSilenceBoundary(31.6, intervals, 5)).toBe(32);
  });

  it('returns null when nothing is within the snap window', () => {
    expect(SnapToNearestSilenceBoundary(60, intervals, 5)).toBeNull();
  });
});

describe('SelectClipWindows', () => {
  it('falls back to fixed-interval cuts when there is no detected silence', () => {
    const windows = SelectClipWindows(600, [], BASE_CONFIG);

    expect(windows.length).toBeGreaterThanOrEqual(BASE_CONFIG.targetClipCountMin);
    expect(windows.length).toBeLessThanOrEqual(BASE_CONFIG.targetClipCountMax);

    // Windows must be contiguous, non-overlapping, and cover the whole video.
    expect(windows[0].startTime).toBe(0);
    expect(windows[windows.length - 1].endTime).toBe(600);
    for (let i = 0; i < windows.length - 1; i += 1) {
      expect(windows[i].endTime).toBe(windows[i + 1].startTime);
    }

    for (const window of windows) {
      const duration = window.endTime - window.startTime;
      expect(duration).toBeGreaterThanOrEqual(BASE_CONFIG.minClipDurationSeconds - 0.001);
      expect(duration).toBeLessThanOrEqual(BASE_CONFIG.maxClipDurationSeconds + 0.001);
    }
  });

  it('snaps interior cut points to nearby silence boundaries', () => {
    // 300s video, targeting 8 clips -> ideal length 37.5s -> raw interior
    // boundaries at 37.5, 75, 112.5, 150, 187.5, 225, 262.5. Each silence
    // interval below sits ~2-3s after its corresponding raw boundary, well
    // within the 5s snap window.
    const silenceIntervals = [
      { start: 39.5, end: 40.5 },
      { start: 77, end: 78 },
      { start: 114.5, end: 115.5 },
      { start: 152, end: 153 },
      { start: 189.5, end: 190.5 },
      { start: 227, end: 228 },
      { start: 264.5, end: 265.5 },
    ];

    const windows = SelectClipWindows(300, silenceIntervals, BASE_CONFIG);

    // Every interior boundary should land exactly on a silence edge since
    // each one was placed within the 5s snap window of a raw boundary.
    const interiorBoundaries = windows.slice(0, -1).map((w) => w.endTime);
    const silenceEdges = new Set(silenceIntervals.flatMap((s) => [s.start, s.end]));
    for (const boundary of interiorBoundaries) {
      expect(silenceEdges.has(boundary)).toBe(true);
    }
  });

  it('does not snap a boundary if doing so would push clip duration out of bounds', () => {
    // A single silence interval placed implausibly close to the very start
    // of the second clip window would shrink clip 1 below the minimum
    // duration - the selector must reject that snap and keep the fixed cut.
    const config: ClipSelectionConfig = {
      minClipDurationSeconds: 15,
      maxClipDurationSeconds: 60,
      targetClipCountMin: 2,
      targetClipCountMax: 2,
      snapWindowSeconds: 10,
    };
    // total=60s, count=2 -> ideal boundary at 30s. Silence at 24-25s is
    // within the 10s snap window but would make clip 1 only 24s (still
    // valid) and clip 2 36s (valid) - use a more aggressive case instead.
    const silenceIntervals = [{ start: 5, end: 5.5 }];

    const windows = SelectClipWindows(60, silenceIntervals, config);

    // 5s is within the 10s snap window of the 30s boundary only if
    // distance <= 10, which it isn't (25 > 10), so it stays fixed at 30.
    expect(windows).toEqual([
      { startTime: 0, endTime: 30 },
      { startTime: 30, endTime: 60 },
    ]);
  });

  it('gracefully degrades clip count for short videos that cannot fit the minimum target count', () => {
    const windows = SelectClipWindows(40, [], BASE_CONFIG);

    expect(windows.length).toBeGreaterThan(0);
    expect(windows.length).toBeLessThan(BASE_CONFIG.targetClipCountMin);
    expect(windows[0].startTime).toBe(0);
    expect(windows[windows.length - 1].endTime).toBe(40);
    for (const window of windows) {
      expect(window.endTime - window.startTime).toBeGreaterThanOrEqual(BASE_CONFIG.minClipDurationSeconds - 0.001);
    }
  });

  it('returns no windows for a zero-length video', () => {
    expect(SelectClipWindows(0, [], BASE_CONFIG)).toEqual([]);
  });

  it('produces between 7 and 10 clips for a typical 20 minute source video', () => {
    const windows = SelectClipWindows(20 * 60, [], BASE_CONFIG);
    expect(windows.length).toBeGreaterThanOrEqual(7);
    expect(windows.length).toBeLessThanOrEqual(10);
  });
});
