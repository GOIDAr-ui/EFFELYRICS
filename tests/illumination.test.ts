import { describe, expect, it } from 'vitest';
import { graphemes, letterLight } from '../src/core/illumination';
describe('per-grapheme illumination',()=>{
 it('keeps Russian, English, combining accents and emoji clusters intact',()=>{expect(graphemes('Я e\u0301 👩‍🚀!')).toEqual(['Я',' ','e\u0301',' ','👩‍🚀','!']);});
 it('lights independent neighbours with overlap, not a shared mask',()=>{const letters=Array.from({length:4},(_,i)=>letterLight(.45,0,1,i,4));expect(letters[0].brightness).toBe(1);expect(letters[1].brightness).toBeGreaterThan(0);expect(letters[1].brightness).toBeLessThan(1);expect(letters[3].brightness).toBe(0);});
 it('fully lights then dims sung letters without restoring waiting brightness',()=>{expect(letterLight(1,0,1,3,4).brightness).toBe(1);const sung=letterLight(1.4,0,1,3,4);expect(sung.brightness).toBeCloseTo(.34);expect(sung.glow).toBe(0);expect(sung.phase).toBe('sung');});
 it('has no light before a word or when timing is missing',()=>{expect(letterLight(0,1,2,0,4).brightness).toBe(0);expect(letterLight(null,1,2,0,4).glow).toBe(0);});
 it('freezes on pause and recomputes when seeking backwards',()=>{expect(letterLight(.5,0,1,1,4)).toEqual(letterLight(.5,0,1,1,4));expect(letterLight(2,0,1,1,4).phase).toBe('sung');expect(letterLight(.1,0,1,1,4).brightness).toBe(0);});
 it('does not stretch very short words or divide by zero',()=>{expect(letterLight(.01,0,.01,3,4).brightness).toBe(1);expect(letterLight(1,1,1,0,4).brightness).toBe(0);});
 it('reduces motion without glow while retaining sung distinction',()=>{expect(letterLight(.1,0,1,3,4,true)).toMatchObject({brightness:1,glow:0});expect(letterLight(2,0,1,3,4,true).brightness).toBeCloseTo(.34);});
});
