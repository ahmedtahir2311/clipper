import { describe, expect, it } from 'vitest';
import { BuildAssSubtitle } from '../src/shared/ffmpeg/ass-subtitle-builder';
import type { CaptionSegment } from '@clipper/shared';

describe('BuildAssSubtitle', () => {
  it('includes the fixed 9:16 canvas size and both required sections', () => {
    const segments: CaptionSegment[] = [{ text: 'Hello world', startTime: 0, endTime: 2 }];
    const ass = BuildAssSubtitle('simple', segments);

    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('[Events]');
  });

  it('formats dialogue timestamps as H:MM:SS.CC', () => {
    const segments: CaptionSegment[] = [{ text: 'Hi', startTime: 65.5, endTime: 70.25 }];
    const ass = BuildAssSubtitle('simple', segments);

    // 65.5s -> 0:01:05.50, 70.25s -> 0:01:10.25 (rounded to nearest centisecond)
    expect(ass).toContain('Dialogue: 0,0:01:05.50,0:01:10.25,Default,,0,0,0,,Hi');
  });

  it('sorts segments by start time regardless of input order', () => {
    const segments: CaptionSegment[] = [
      { text: 'second', startTime: 5, endTime: 6 },
      { text: 'first', startTime: 0, endTime: 1 },
    ];
    const ass = BuildAssSubtitle('simple', segments);

    const firstIndex = ass.indexOf('first');
    const secondIndex = ass.indexOf('second');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });

  it('escapes ASS override-tag characters and newlines so caption text cannot inject tags', () => {
    const segments: CaptionSegment[] = [{ text: 'Use {\\pos(0,0)} and a\nnewline', startTime: 0, endTime: 1 }];
    const ass = BuildAssSubtitle('simple', segments);

    expect(ass).toContain('Use \\{\\\\pos(0,0)\\} and a\\Nnewline');
    // The literal (unescaped) override tag must never appear in the output.
    expect(ass).not.toContain('{\\pos(0,0)}');
  });

  it('emits plain text for the simple and highlighter-box styles (no karaoke tags)', () => {
    const segments: CaptionSegment[] = [{ text: 'plain text here', startTime: 0, endTime: 3 }];

    for (const style of ['simple', 'highlighter-box'] as const) {
      const ass = BuildAssSubtitle(style, segments);
      expect(ass).toContain(',,plain text here');
      expect(ass).not.toContain('\\k');
    }
  });

  it('emits per-word \\k karaoke tags whose centisecond durations sum to the segment duration', () => {
    const segments: CaptionSegment[] = [{ text: 'one two three', startTime: 0, endTime: 3 }];
    const ass = BuildAssSubtitle('karaoke', segments);

    const kTags = [...ass.matchAll(/\\k(\d+)/g)].map((m) => Number(m[1]));
    expect(kTags).toHaveLength(3);
    expect(kTags.reduce((sum, d) => sum + d, 0)).toBe(300); // 3.00s == 300 centiseconds
  });

  it('gives longer words a larger share of the karaoke duration', () => {
    const segments: CaptionSegment[] = [{ text: 'a supercalifragilistic', startTime: 0, endTime: 2 }];
    const ass = BuildAssSubtitle('karaoke', segments);

    const kTags = [...ass.matchAll(/\\k(\d+)/g)].map((m) => Number(m[1]));
    expect(kTags[1]).toBeGreaterThan(kTags[0]);
  });

  it('produces a valid document with zero segments', () => {
    const ass = BuildAssSubtitle('simple', []);
    expect(ass).toContain('[Events]');
    expect(ass.split('\n').filter((line) => line.startsWith('Dialogue:'))).toHaveLength(0);
  });
});
