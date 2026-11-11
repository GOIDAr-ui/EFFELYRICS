import { describe, expect, it } from 'vitest';
import { AutomaticLyricsService, matches, type AutomaticProvider } from '../src/core/AutomaticLyricsService';
import { fillProgress } from '../src/core/fill';
import { demoLyrics } from '../src/core/demo';
import { parseEnhancedLRC } from '../electron/lyrics';
const track = { title: 'First light', artist: 'Aurora', duration: 40 };
const candidate = { ...track, id: 'one', source: 'fixture' };
describe('automatic lyrics', () => {
 it('matches normalization but rejects remixes and wrong durations', () => { expect(matches(track,{...candidate,title:'FIRST LIGHT!'})).toBe(true); expect(matches(track,{...candidate,title:'First light (Live)'})).toBe(false); expect(matches(track,{...candidate,duration:55})).toBe(false); });
 it('uses session cache without requesting again', async () => { let calls=0; const p:AutomaticProvider={search:async()=>{calls++;return [candidate];},load:async()=>demoLyrics};const service=new AutomaticLyricsService([p]); const signal=new AbortController().signal;expect((await service.find(track,signal)).status).toBe('found');await service.find(track,signal);expect(calls).toBe(1); });
 it('reports absence and ambiguity without selecting the first', async()=>{ const s=new AbortController().signal;expect((await new AutomaticLyricsService([]).find(track,s)).status).toBe('none'); const p:AutomaticProvider={search:async()=>[candidate,{...candidate,id:'two'}],load:async()=>demoLyrics};expect((await new AutomaticLyricsService([p]).find(track,s)).status).toBe('ambiguous'); });
 it('does not apply an aborted load',async()=>{const c=new AbortController();const p:AutomaticProvider={search:async()=>[candidate],load:async()=>{c.abort();return demoLyrics;}};await expect(new AutomaticLyricsService([p]).find(track,c.signal)).rejects.toThrow('Aborted');});
 it('rejects line LRC and accepts actual enhanced word boundaries',()=>{expect(parseEnhancedLRC('[00:01.00]A whole line','a')).toBeNull();expect(parseEnhancedLRC('[00:01.00]<00:01.00>Hello <00:02.00>world<00:03.00>','b')?.lines[0].words).toHaveLength(2);});
});
describe('letter fill',()=>{it('follows time across pause and bidirectional seek',()=>{expect(fillProgress(1.5,1,2)).toBe(.5);expect(fillProgress(1.5,1,2)).toBe(.5);expect(fillProgress(3,1,2)).toBe(1);expect(fillProgress(0,1,2)).toBe(0);});it('handles short and zero duration words',()=>{expect(fillProgress(.005,0,.01)).toBe(.5);expect(fillProgress(1,1,1)).toBe(0);});});
