import type { CaptionSegment, CaptionStyle } from '@clipper/shared';

/** All clips are reframed to this fixed 9:16 resolution (see video-transform.service.ts), so the ASS canvas can be hardcoded to match. */
const PLAY_RES_X = 1080;
const PLAY_RES_Y = 1920;

interface AssStyleDef {
  /** Everything after "Style: Default," in the [V4+ Styles] Format line - see the Format header in BuildAssSubtitle for field order. */
  line: string;
}

const STYLE_DEFS: Record<CaptionStyle, AssStyleDef> = {
  // White bold text, black outline, no background - the plain default look.
  simple: { line: 'Arial,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,2,60,60,180,1' },
  // PrimaryColour (yellow) is the "already highlighted" word, SecondaryColour
  // (white) is "not yet highlighted" - libass reveals \k-tagged runs from
  // Secondary to Primary as each word's timer elapses.
  karaoke: { line: 'Arial,64,&H0000FFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,2,60,60,180,1' },
  // BorderStyle=3 renders an opaque box using BackColour instead of an outline.
  'highlighter-box': { line: 'Arial,64,&H00000000,&H00000000,&H00000000,&H0000FF00,1,0,0,0,100,100,0,0,3,0,0,2,60,60,180,1' },
};

function FormatAssTime(seconds: number): string {
  const totalCentiseconds = Math.max(0, Math.round(seconds * 100));
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/** Escapes characters that have special meaning in ASS override-tag syntax, so caption text can never inject its own tags. */
function EscapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N');
}

/**
 * Splits karaoke timing across words proportionally to word length (longer
 * words get more highlight time), rounded to centiseconds with any rounding
 * drift folded into the last word so durations sum exactly.
 */
function ComputeWordDurationsCentiseconds(words: string[], totalDurationSeconds: number): number[] {
  const totalChars = words.reduce((sum, word) => sum + word.length, 0) || 1;
  const totalCentiseconds = Math.max(words.length, Math.round(totalDurationSeconds * 100));

  const durations = words.map((word) => Math.max(1, Math.round((word.length / totalChars) * totalCentiseconds)));
  const drift = totalCentiseconds - durations.reduce((sum, d) => sum + d, 0);
  durations[durations.length - 1] += drift;

  return durations;
}

function BuildDialogueLine(segment: CaptionSegment, style: CaptionStyle): string {
  const start = FormatAssTime(segment.startTime);
  const end = FormatAssTime(segment.endTime);

  let text: string;
  if (style === 'karaoke') {
    const words = segment.text.split(/\s+/).filter((w) => w.length > 0);
    const durations = ComputeWordDurationsCentiseconds(words, segment.endTime - segment.startTime);
    text = words.map((word, i) => `{\\k${durations[i]}}${EscapeAssText(word)}`).join(' ');
  } else {
    text = EscapeAssText(segment.text);
  }

  return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
}

/**
 * Builds a full .ass subtitle document for one clip's captions. Pure and
 * side-effect free - the caption-burn processor writes the result to a
 * temp .ass file and passes it to ffmpeg's `-vf ass=...` filter.
 */
export function BuildAssSubtitle(style: CaptionStyle, segments: CaptionSegment[]): string {
  const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);
  const dialogueLines = sortedSegments.map((segment) => BuildDialogueLine(segment, style));

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${PLAY_RES_X}`,
    `PlayResY: ${PLAY_RES_Y}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${STYLE_DEFS[style].line}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...dialogueLines,
    '',
  ].join('\n');
}
