import { z } from 'zod';

/**
 * Pure display templates - the user supplies the caption text and rough
 * timing themselves (there's no speech-to-text/transcription in this app).
 * "Karaoke" here means the words within a segment highlight one-by-one,
 * evenly spaced across that segment's declared duration - not audio-synced.
 */
export const CaptionStyleSchema = z.enum(['simple', 'karaoke', 'highlighter-box']);
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

export const CAPTION_STYLE_LABELS: Record<CaptionStyle, string> = {
  simple: 'Simple',
  karaoke: 'Karaoke',
  'highlighter-box': 'Highlighter Box',
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
