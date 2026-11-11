import type { LyricsDocument } from './types';
import { TTMLParser } from './TTMLParser';
export interface LyricsProvider { load(trackId: string, signal?: AbortSignal): Promise<LyricsDocument | null> }
/** Explicit per-track binding prevents imported lyrics leaking into the next song. */
export class ImportedLyricsProvider implements LyricsProvider {
  private documents = new Map<string, LyricsDocument>();
  import(trackId: string, xml: string) { const doc = new TTMLParser().parse(xml, trackId); this.documents.set(trackId, doc); return doc; }
  async load(trackId: string) { return this.documents.get(trackId) ?? null; }
}
