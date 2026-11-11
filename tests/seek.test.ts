import { describe, expect, it } from 'vitest';
import { SeekController, seekTarget } from '../src/core/SeekController';
import { emptySnapshot, type MediaSnapshot } from '../src/core/types';
const snapshot = (position = 1, revision = 100): MediaSnapshot => ({ ...emptySnapshot(), connection: 'connected', trackId: 'a', position, duration: 40, seekSupported: true, timelineUpdatedAt: revision });
describe('seek', () => {
 it('clamps seconds and rejects zero, missing or nonfinite duration',()=>{expect(seekTarget(55,40)).toBe(40);expect(seekTarget(-1,40)).toBe(0);expect(seekTarget(5,0)).toBeNull();expect(seekTarget(5,null)).toBeNull();expect(seekTarget(NaN,40)).toBeNull();});
 it('confirms only a fresh observed system position',async()=>{const c=new SeekController(snapshot(),async()=>({ok:true}));const result=c.request(20);await Promise.resolve();c.observe(snapshot(20,101));expect(await result).toMatchObject({ok:true,status:'confirmed',actual:20});});
 it('does not confirm an accepted command without a new timeline',async()=>{const c=new SeekController(snapshot(),async()=>({ok:true}),15);const r=c.request(20);c.observe(snapshot(20,100));expect(await r).toMatchObject({ok:false,status:'unconfirmed'});});
 it('reports session refusal and IPC failures',async()=>{const c=new SeekController(snapshot(),async()=>({ok:false,error:'Denied'}));expect(await c.request(20)).toMatchObject({status:'rejected',error:'Denied'});const broken=new SeekController(snapshot(),async()=>{throw Error('pipe');});expect(await broken.request(20)).toMatchObject({status:'rejected',error:'Ошибка IPC при перемотке.'});});
 it('disables unsupported and unknown seek',async()=>{for(const supported of [false,null,undefined]){const c=new SeekController({...snapshot(),seekSupported:supported},async()=>{throw Error('must not send');});expect((await c.request(10)).status).toBe('rejected');}});
 it('supersedes rapid requests without applying old acknowledgements',async()=>{const c=new SeekController(snapshot(),async()=>({ok:true}));const old=c.request(10);const latest=c.request(30);await Promise.resolve();c.observe(snapshot(10,101));expect((await old).status).toBe('superseded');c.observe(snapshot(30,102));expect((await latest).status).toBe('confirmed');});
 it('rejects track change and never confirms previous song',async()=>{const c=new SeekController(snapshot(),async()=>({ok:true}));const r=c.request(20);c.observe({...snapshot(20,101),trackId:'b'});expect((await r).status).toBe('rejected');});
});
