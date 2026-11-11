import { describe, expect, it } from 'vitest';
import { PlaybackClock } from '../src/core/PlaybackClock';
import { LyricSyncEngine } from '../src/core/LyricSyncEngine';
import { demoLyrics } from '../src/core/demo';
function setup() { let now = 0; const clock = new PlaybackClock(() => now); clock.update({ trackId: 'one', position: 0, playing: true, duration: 40 }); return { clock, advance: (seconds: number) => { now += seconds; } }; }
describe('PlaybackClock', () => {
  it('uses elapsed monotonic time rather than frame count', () => { const { clock, advance } = setup(); advance(13.3); expect(clock.time()).toBeCloseTo(13.3); });
  it('freezes on pause', () => { const { clock, advance } = setup(); advance(4); clock.pause(); advance(20); expect(clock.time()).toBe(4); });
  it('resumes without accumulated pause delay', () => { const { clock, advance } = setup(); advance(4); clock.pause(); advance(20); clock.resume(); advance(2); expect(clock.time()).toBe(6); });
  it('seeks immediately both forwards and backwards', () => { const { clock, advance } = setup(); advance(12); clock.seek(30); expect(clock.time()).toBe(30); clock.seek(1); expect(clock.time()).toBe(1); });
  it('honors authoritative position updates', () => { const { clock, advance } = setup(); advance(20); clock.update({ trackId: 'one', position: 3, playing: true, duration: 40 }); expect(clock.time()).toBe(3); });
  it('resets on track changes with no position', () => { const { clock, advance } = setup(); advance(20); clock.update({ trackId: 'two', position: null, playing: false, duration: null }); expect(clock.time()).toBe(0); });
  it('handles missing duration and playback rate', () => { const { clock, advance } = setup(); clock.update({ trackId: 'one', position: 5, playing: true, duration: null, rate: 2 }); advance(4); expect(clock.time()).toBe(13); });
  it('clamps to duration', () => { const { clock, advance } = setup(); advance(60); expect(clock.time()).toBe(40); });
});
describe('LyricSyncEngine', () => {
  const engine = new LyricSyncEngine();
  it('selects a word with half-open timing boundaries', () => { expect(engine.select(demoLyrics, 0)).toEqual({ lineIndex: 0, wordIndex: 0 }); expect(engine.select(demoLyrics, 1.15)).toEqual({ lineIndex: 0, wordIndex: 1 }); });
  it('immediately selects the sought word without animation state', () => { engine.select(demoLyrics, 1); expect(engine.select(demoLyrics, 26)).toEqual({ lineIndex: 5, wordIndex: 0 }); expect(engine.select(demoLyrics, 0)).toEqual({ lineIndex: 0, wordIndex: 0 }); });
  it('corrects both positive and negative offsets', () => { expect(engine.select(demoLyrics, 4, 1).lineIndex).toBe(1); expect(engine.select(demoLyrics, 5, -1).lineIndex).toBe(0); });
  it('clears old highlighting when document is missing or ends', () => { expect(engine.select(null, 12)).toEqual({ lineIndex: -1, wordIndex: -1 }); expect(engine.select(demoLyrics, 40).lineIndex).toBe(-1); });
  it('does not hold a word in the gap after its end', () => { expect(engine.select(demoLyrics, 4.8)).toEqual({ lineIndex: 0, wordIndex: -1 }); });
});
