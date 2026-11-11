export interface LyricWord { id: string; text: string; start: number; end: number }
export interface LyricLine { id: string; start: number; end: number; words: LyricWord[] }
export interface LyricsDocument { id: string; title?: string; lines: LyricLine[]; timing: 'word' | 'line' }
export type PlaybackState = 'playing' | 'paused' | 'stopped';
export type MediaCommand = 'toggle' | 'next' | 'previous';
export interface MediaSnapshot {
  connection: 'connected' | 'unavailable' | 'error';
  message?: string; sourceId?: string; trackId: string;
  title?: string; artist?: string; album?: string; artwork?: string;
  playback: PlaybackState; position: number | null; duration: number | null;
  rate: number; timelineAge: number;
  capabilities: Record<MediaCommand, boolean>;
  sessions: string[];
}
export const emptySnapshot = (message = 'Откройте Apple Music и включите композицию.'): MediaSnapshot => ({
  connection: 'unavailable', message, trackId: '', playback: 'stopped',
  position: null, duration: null, rate: 1, timelineAge: 0,
  capabilities: { toggle: false, next: false, previous: false }, sessions: [],
});
export interface CommandResult { ok: boolean; error?: string }
export interface AuroraAPI {
  getSnapshot(): Promise<MediaSnapshot>;
  onSnapshot(listener: (snapshot: MediaSnapshot) => void): () => void;
  command(command: MediaCommand): Promise<CommandResult>;
  importTTML(): Promise<{ name: string; content: string } | null>;
  fullscreen(): Promise<void>;
}
declare global { interface Window { aurora?: AuroraAPI } }
