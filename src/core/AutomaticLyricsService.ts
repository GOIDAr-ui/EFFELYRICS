import type { LyricsDocument } from './types';
export interface TrackQuery { title: string; artist: string; album?: string; duration?: number | null }
export interface LyricsCandidate { id: string; title: string; artist: string; album?: string; duration?: number; source: string }
export interface AutomaticProvider { search(track: TrackQuery, signal: AbortSignal): Promise<LyricsCandidate[]>; load(candidate: LyricsCandidate, signal: AbortSignal): Promise<LyricsDocument | null> }
export interface AutomaticResult { status: 'found' | 'none' | 'ambiguous' | 'error'; document: LyricsDocument | null; source: string; candidates: LyricsCandidate[] }
export const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function matches(track: TrackQuery, candidate: LyricsCandidate) {
  return normalize(track.title) === normalize(candidate.title) && normalize(track.artist) === normalize(candidate.artist)
    && (!track.album || !candidate.album || normalize(track.album) === normalize(candidate.album))
    && (track.duration == null || candidate.duration == null || Math.abs(track.duration - candidate.duration) <= 3);
}
export class AutomaticLyricsService {
  private cache = new Map<string, AutomaticResult>();
  constructor(private providers: AutomaticProvider[]) {}
  async find(track: TrackQuery, signal: AbortSignal, choice?: string): Promise<AutomaticResult> {
    const key = JSON.stringify(track) + (choice ?? '');
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const cached = this.cache.get(key); if (cached) return cached;
    let failed = false; const candidates: LyricsCandidate[] = [];
    for (const provider of this.providers) {
      try {
        candidates.push(...(await provider.search(track, signal)).filter(c => matches(track, c)));
      } catch { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); failed = true; }
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const selected = choice ? candidates.find(c => c.id === choice) : candidates.length === 1 ? candidates[0] : undefined;
    let result: AutomaticResult = { status: candidates.length > 1 ? 'ambiguous' : failed ? 'error' : 'none', document: null, source: '', candidates };
    if (selected) {
      for (const p of this.providers) {
        try { const document = await p.load(selected, signal); if (document) { result = { status: 'found', document, source: selected.source, candidates }; break; } } catch { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); }
      }
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (this.cache.size >= 50) this.cache.delete(this.cache.keys().next().value!);
    // Session-local only: no redistribution or unverified persistent rights grants.
    this.cache.set(key, result); return result;
  }
}
