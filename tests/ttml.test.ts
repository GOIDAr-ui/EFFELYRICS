import { describe, expect, it } from 'vitest';
import { TTMLParser, parseTime } from '../src/core/TTMLParser';
import { ImportedLyricsProvider } from '../src/core/LyricsProvider';
const wrap = (p: string) => `<tt xmlns="http://www.w3.org/ns/ttml"><body><div>${p}</div></body></tt>`;
describe('TTMLParser', () => {
  const parser = new TTMLParser();
  it('parses timestamped words and preserves adjacent punctuation', () => { const doc = parser.parse(wrap('<p begin="10s" end="14s"><span begin="0s" end="1s">Свет, </span><span begin="1s" end="4s">лети!</span></p>')); expect(doc.timing).toBe('word'); expect(doc.lines[0].words.map(w => [w.text, w.start, w.end])).toEqual([['Свет, ', 10, 11], ['лети!', 11, 14]]); });
  it('keeps a line-only TTML line usable', () => { const doc = parser.parse(wrap('<p begin="00:00:01.000" dur="2s">Просто строка</p>')); expect(doc.timing).toBe('line'); expect(doc.lines[0]).toMatchObject({ start: 1, end: 3 }); });
  it('supports namespaces, container offsets and inherited ends', () => { const doc = parser.parse('<tt:tt xmlns:tt="http://www.w3.org/ns/ttml"><tt:body begin="2s" end="10s"><tt:div><tt:p begin="1s"><tt:span begin="1s">Hello &amp; light</tt:span></tt:p></tt:div></tt:body></tt:tt>'); expect(doc.lines[0].words[0]).toMatchObject({ text: 'Hello & light', start: 4, end: 10 }); });
  it('sorts lines by time', () => { const doc = parser.parse(wrap('<p begin="5s" end="7s">B</p><p begin="1s" end="2s">A</p>')); expect(doc.lines[0].words[0].text).toBe('A'); });
  it.each(['<tt><body>', '<html/>', wrap('<p>Untimed</p>'), wrap('<p begin="4s" end="1s">Backwards</p>'), wrap('<p begin="1s" end="2s"><span begin="3s">Outside</span></p>'), wrap('<p begin="00:00:01:20" end="4s">Frames</p>'), '<!DOCTYPE tt [<!ENTITY x "text">]><tt/>', '<tt><body timeContainer="seq"><p begin="0s" end="1s">A</p></body></tt>'])('rejects invalid or unsupported input (%s)', xml => { expect(() => parser.parse(xml)).toThrow(); });
  it('rejects oversized imports', () => { expect(() => parser.parse('a'.repeat(2_000_001))).toThrow(/большой/); });
  it('parses supported units', () => { expect(parseTime('500ms')).toBe(.5); expect(parseTime('1.5m')).toBe(90); expect(parseTime('01:02:03.500')).toBe(3723.5); expect(() => parseTime('00:99:00')).toThrow(); });
  it('binds imports to a track and does not return stale lyrics', async () => { const provider = new ImportedLyricsProvider(); provider.import('track-a', wrap('<p begin="0s" end="1s">A</p>')); expect((await provider.load('track-a'))?.lines).toHaveLength(1); expect(await provider.load('track-b')).toBeNull(); });
});
it('accepts AMLL absolute container and word times without doubling offsets', () => {
 const d=new TTMLParser().parse('<tt><body dur="00:30.00"><div begin="00:10.00" end="00:20.00"><p begin="00:10.00" end="00:12.00"><span begin="00:10.00" end="00:11.00">A</span></p></div></body></tt>','amll',true);
 expect(d.lines[0].words[0].start).toBe(10);
});
