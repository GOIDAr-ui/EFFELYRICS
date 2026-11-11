import type { LyricsDocument } from './types';
export interface LyricSelection { lineIndex: number; wordIndex: number }
export class LyricSyncEngine {
  /** Positive offset displays lyrics earlier; all boundaries are [start, end). */
  select(document: LyricsDocument | null, position: number, offset = 0): LyricSelection {
    const time = position + offset;
    if (!document || !Number.isFinite(time)) return { lineIndex: -1, wordIndex: -1 };
    const lineIndex = document.lines.findIndex(line => time >= line.start && time < line.end);
    if (lineIndex < 0) return { lineIndex: -1, wordIndex: -1 };
    return { lineIndex, wordIndex: document.lines[lineIndex].words.findIndex(word => time >= word.start && time < word.end) };
  }
}
