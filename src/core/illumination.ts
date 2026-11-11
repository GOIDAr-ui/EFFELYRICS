import { fillProgress } from './fill';
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
/** Segment visible graphemes; whitespace is preserved but consumes no illumination slot. */
export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), part => part.segment);
  const result: string[] = [];
  for (const point of Array.from(text)) {
    if (result.length && (/\p{Mark}|[\uFE0E\uFE0F\u200D]|[\u{1F3FB}-\u{1F3FF}]/u.test(point) || result.at(-1)!.endsWith('\u200D'))) result[result.length - 1] += point;
    else result.push(point);
  }
  return result;
}
const smooth = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x*x*(3-2*x); };
export function letterLight(time: number | null, start: number, end: number, index: number, count: number, reduced = false) {
  if (time === null || ![time,start,end].every(Number.isFinite) || end <= start || count <= 0 || time < start) return { brightness: 0, glow: 0, phase: 'waiting' };
  if (time >= end) {
    const fade = smooth((time-end-.05)/.25);
    return { brightness: 1-.66*fade, glow: reduced ? 0 : 1-fade, phase: 'sung' };
  }
  const progress = fillProgress(time,start,end);
  const brightness = reduced ? 1 : smooth((progress*(count+.5)-index)/1.5);
  return { brightness, glow: reduced ? 0 : brightness, phase: 'active' };
}
export function lineLight(time: number | null, start: number, end: number) {
  if (time === null || time < start) return .62;
  return time < end ? 1 : 1-.52*smooth((time-end)/.32);
}
