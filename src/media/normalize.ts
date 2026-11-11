import { emptySnapshot, type MediaSnapshot } from '../core/types';
export function normalizeSnapshot(value: unknown): MediaSnapshot {
  if (!value || typeof value !== 'object') return emptySnapshot('Некорректный ответ Windows-моста.');
  const v = value as Record<string, unknown>;
  const text = (key: string) => typeof v[key] === 'string' ? (v[key] as string).slice(0, 4096) : undefined;
  const number = (key: string) => typeof v[key] === 'number' && Number.isFinite(v[key]) && (v[key] as number) >= 0 ? v[key] as number : null;
  const capabilities = (v.capabilities ?? {}) as Record<string, unknown>;
  const connected = v.connection === 'connected';
  const artwork = typeof v.artwork === 'string' && v.artwork.length < 3_000_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.artwork) ? v.artwork : undefined;
  return {
    connection: connected ? 'connected' : v.connection === 'error' ? 'error' : 'unavailable',
    message: text('message'), sourceId: text('sourceId'), trackId: text('trackId') ?? '',
    title: text('title'), artist: text('artist'), album: text('album'), artwork,
    playback: v.playback === 'playing' ? 'playing' : v.playback === 'paused' ? 'paused' : 'stopped',
    position: number('position'), duration: number('duration'), rate: typeof v.rate === 'number' && Number.isFinite(v.rate) ? v.rate : 1,
    timelineAge: Math.min(3600, number('timelineAge') ?? 0),
    capabilities: { toggle: connected && capabilities.toggle === true, next: connected && capabilities.next === true, previous: connected && capabilities.previous === true },
    sessions: Array.isArray(v.sessions) ? v.sessions.filter((s): s is string => typeof s === 'string').slice(0, 100) : [],
  };
}
