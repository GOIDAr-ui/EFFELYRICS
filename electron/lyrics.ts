import { AutomaticLyricsService, type AutomaticProvider, type LyricsCandidate, type TrackQuery } from '../src/core/AutomaticLyricsService';
import { TTMLParser } from '../src/core/TTMLParser';
import type { LyricsDocument } from '../src/core/types';
async function download(url: string, signal: AbortSignal, limit = 2_000_000) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), headers: { 'User-Agent': 'AuroraLyrics/0.1.1 (desktop companion)' } });
  if (!response.ok || !response.body) throw Error(`Источник: HTTP ${response.status}`);
  const reader = response.body.getReader(); let bytes = 0, text = ''; const decoder = new TextDecoder();
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > limit) throw Error('Ответ источника слишком большой'); text += decoder.decode(value, { stream: true }); } return text + decoder.decode(); } finally { await reader.cancel(); }
}
class AMLL implements AutomaticProvider {
  private index?: LyricsCandidate[];
  async search(_track: TrackQuery, signal: AbortSignal) {
    if (!this.index) {
      const text = await download('https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/metadata/raw-lyrics-index.jsonl', signal, 30_000_000);
      this.index = text.split('\n').filter(Boolean).map(line => {
        const row = JSON.parse(line); const meta = Object.fromEntries(row.metadata);
        return { id: `amll:${row.rawLyricFile}`, title: meta.musicName?.[0] ?? '', artist: (meta.artists ?? []).join(' '), album: meta.album?.[0], source: 'AMLL TTML DB' };
      });
    } return this.index;
  }
  async load(c: LyricsCandidate, signal: AbortSignal) {
    if (!/^amll:[\w-]+\.ttml$/.test(c.id)) return null;
    const doc = new TTMLParser().parse(await download(`https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main/raw-lyrics/${c.id.slice(5)}`, signal), c.id, true);
    return doc.timing === 'word' ? doc : null;
  }
}
export function parseEnhancedLRC(text: string, id: string): LyricsDocument | null {
  const stamp = '(\\d{1,3}):(\\d{2}(?:\\.\\d+)?)';
  const lines = text.split('\n').flatMap((line, index) => {
    const header = new RegExp(`^\\[${stamp}\\]`).exec(line); if (!header) return [];
    const words = [...line.matchAll(new RegExp(`<${stamp}>([^<]*)`, 'g'))];
    if (words.length < 2) return [];
    const timed = words.slice(0,-1).map((w,i) => ({ id: `${index}-${i}`, text: w[3], start: +w[1]*60 + +w[2], end: +words[i+1][1]*60 + +words[i+1][2] }));
    if (!timed.length || words.at(-1)![3].trim() || timed.some(w => w.end <= w.start)) return [];
    return [{ id: String(index), start: +header[1]*60 + +header[2], end: timed.at(-1)!.end, words: timed }];
  });
  return lines.length && lines.length === text.split('\n').filter(line => /^\[\d+:\d/.test(line)).length ? { id, timing: 'word', lines } : null;
}
class LRCLIB implements AutomaticProvider {
  private documents = new Map<string, LyricsDocument>();
  async search(track: TrackQuery, signal: AbortSignal) {
    const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    const rows = JSON.parse(await download(`https://lrclib.net/api/search?${params}`, signal));
    if (!Array.isArray(rows)) throw Error('Некорректный ответ LRCLIB');
    return rows.slice(0,100).flatMap(row => {
      const id = `lrclib:${row.id}`; const doc = typeof row.syncedLyrics === 'string' ? parseEnhancedLRC(row.syncedLyrics, id) : null;
      if (!doc) return []; if (this.documents.size >= 500) this.documents.delete(this.documents.keys().next().value!); this.documents.set(id, doc);
      return [{ id, title: String(row.trackName ?? ''), artist: String(row.artistName ?? ''), album: row.albumName, duration: row.duration, source: 'LRCLIB · enhanced LRC' }];
    });
  }
  async load(c: LyricsCandidate) { return this.documents.get(c.id) ?? null; }
}
export const automaticLyrics = new AutomaticLyricsService([new AMLL(), new LRCLIB()]);
