import { z } from 'zod';

/**
 * Pure display templates - the user supplies the caption text and rough
 * timing themselves (there's no speech-to-text/transcription in this app).
 * "Karaoke" and "fade-word" split a line's words evenly (by word length)
 * across that line's declared duration and reveal them in sequence - not
 * audio-synced, since there's no transcription to sync to.
 */
export const CaptionStyleSchema = z.enum([
  'simple',
  'karaoke',
  'highlighter-box',
  'bold-pop',
  'soft-backdrop',
  'neon-glow',
  'grow-in',
  'fade-word',
]);
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

export const CAPTION_STYLE_LABELS: Record<CaptionStyle, string> = {
  simple: 'Simple',
  karaoke: 'Karaoke',
  'highlighter-box': 'Highlighter Box',
  'bold-pop': 'Bold Pop',
  'soft-backdrop': 'Soft Backdrop',
  'neon-glow': 'Neon Glow',
  'grow-in': 'Grow In',
  'fade-word': 'Fade Word',
};

/** A representative swatch color per style, for the style-picker UI. */
export const CAPTION_STYLE_SWATCHES: Record<CaptionStyle, string> = {
  simple: '#FFFFFF',
  karaoke: '#FFE600',
  'highlighter-box': '#39FF14',
  'bold-pop': '#FFFFFF',
  'soft-backdrop': '#111111',
  'neon-glow': '#00E5FF',
  'grow-in': '#FFFFFF',
  'fade-word': '#FFFFFF',
};

export const CaptionStatusSchema = z.enum(['none', 'pending', 'ready', 'failed']);
export type CaptionStatus = z.infer<typeof CaptionStatusSchema>;

export const CaptionSegmentSchema = z
  .object({
    text: z.string().trim().min(1, 'Caption text is required').max(200),
    startTime: z.number().min(0),
    endTime: z.number().min(0),
  })
  .refine((segment) => segment.endTime > segment.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
export type CaptionSegment = z.infer<typeof CaptionSegmentSchema>;

export const SetCaptionsSchema = z.object({
  style: CaptionStyleSchema,
  segments: z.array(CaptionSegmentSchema).min(1, 'At least one caption line is required').max(50),
});
export type SetCaptionsDto = z.infer<typeof SetCaptionsSchema>;
