export interface SilenceInterval {
  start: number;
  end: number;
}

const SILENCE_START_RE = /silence_start:\s*(-?[\d.]+)/;
const SILENCE_END_RE = /silence_end:\s*(-?[\d.]+)/;

/**
 * Parses ffmpeg `silencedetect` filter stderr output into silence intervals.
 * A trailing `silence_start` with no matching `silence_end` (silence runs to
 * end of file) is closed off using `totalDurationSeconds`.
 */
export function ParseSilenceDetectOutput(stderr: string, totalDurationSeconds: number): SilenceInterval[] {
  const intervals: SilenceInterval[] = [];
  let pendingStart: number | null = null;

  for (const line of stderr.split('\n')) {
    const startMatch = SILENCE_START_RE.exec(line);
    if (startMatch) {
      pendingStart = Number.parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = SILENCE_END_RE.exec(line);
    if (endMatch && pendingStart !== null) {
      intervals.push({ start: pendingStart, end: Number.parseFloat(endMatch[1]) });
      pendingStart = null;
    }
  }

  if (pendingStart !== null && pendingStart < totalDurationSeconds) {
    intervals.push({ start: pendingStart, end: totalDurationSeconds });
  }

  return intervals;
}
