import { describe, expect, it } from 'vitest';
import { normalizeSnapshot } from '../src/media/normalize';
describe('media normalization', () => {
  it('keeps the session usable without optional metadata', () => { expect(normalizeSnapshot({ connection: 'connected', playback: 'paused' })).toMatchObject({ connection: 'connected', title: undefined, artist: undefined, position: null, duration: null }); });
  it('handles malformed snapshots', () => { expect(normalizeSnapshot(null).connection).toBe('unavailable'); expect(normalizeSnapshot({ position: -2, duration: Infinity, rate: NaN }).position).toBeNull(); });
  it('disables commands after session loss', () => { expect(normalizeSnapshot({ connection: 'unavailable', capabilities: { toggle: true } }).capabilities.toggle).toBe(false); });
  it('never accepts external artwork URLs or HTML', () => { expect(normalizeSnapshot({ artwork: 'https://example.com/cover.png' }).artwork).toBeUndefined(); expect(normalizeSnapshot({ artwork: 'data:text/html;base64,abc' }).artwork).toBeUndefined(); });
  it('accepts a bounded embedded image', () => { expect(normalizeSnapshot({ artwork: 'data:image/png;base64,YQ==' }).artwork).toBe('data:image/png;base64,YQ=='); });
});
