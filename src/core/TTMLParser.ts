import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { LyricLine, LyricsDocument, LyricWord } from './types';
type Node = Record<string, unknown>;
const children = (node: Node, key: string): Node[] => Array.isArray(node[key]) ? node[key] as Node[] : [];
function textOf(nodes: Node[]): string {
  return nodes.map(node => '#text' in node ? String(node['#text']) : Object.keys(node).filter(k => k !== ':@').map(k => textOf(children(node, k))).join('')).join('');
}
/** TTML clock time and h/m/s/ms offsets. Unsupported frame/tick timing is explicit. */
export function parseTime(raw: unknown): number {
  if (typeof raw !== 'string') throw new Error('Отсутствует временная метка TTML.');
  const clock = /^(\d{2,}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(raw);
  if (clock) {
    if (+clock[2] >= 60 || +clock[3] >= 60) throw new Error(`Некорректное время: ${raw}`);
    return +clock[1] * 3600 + +clock[2] * 60 + +clock[3];
  }
  const offset = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(raw);
  if (!offset) throw new Error(`Неподдерживаемое время: ${raw}. Используйте hh:mm:ss.mmm или h/m/s/ms.`);
  return +offset[1] * ({ ms: 0.001, s: 1, m: 60, h: 3600 }[offset[2]]!);
}
function interval(attrs: Node, parentStart: number, parentEnd: number) {
  const start = parentStart + (attrs['@_begin'] === undefined ? 0 : parseTime(attrs['@_begin']));
  const end = Math.min(parentEnd, attrs['@_end'] !== undefined ? parentStart + parseTime(attrs['@_end']) : attrs['@_dur'] !== undefined ? start + parseTime(attrs['@_dur']) : parentEnd);
  if (end <= start) throw new Error('Конец TTML-интервала должен быть позже начала.');
  return { start, end };
}
export class TTMLParser {
  parse(xml: string, id = 'import'): LyricsDocument {
    if (xml.length > 2_000_000) throw new Error('TTML слишком большой (максимум 2 МБ).');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD и внешние сущности не поддерживаются.');
    if (XMLValidator.validate(xml) !== true) throw new Error('Некорректный XML.');
    const nodes = new XMLParser({ preserveOrder: true, ignoreAttributes: false, removeNSPrefix: true, trimValues: false, parseTagValue: false, processEntities: true }).parse(xml) as Node[];
    if (!nodes.some(n => 'tt' in n)) throw new Error('Ожидается корневой элемент tt.');
    const lines: LyricLine[] = [];
    let wordTimed = false;
    function visit(items: Node[], parentStart: number, parentEnd: number, depth: number) {
      if (depth > 40) throw new Error('Слишком глубокая вложенность TTML.');
      for (const node of items) {
        const tag = Object.keys(node).find(k => k !== ':@' && !k.startsWith('#') && !k.startsWith('?'));
        if (!tag) continue;
        const attrs = (node[':@'] ?? {}) as Node;
        if (attrs['@_timeContainer'] && attrs['@_timeContainer'] !== 'par') throw new Error('Поддерживаются только параллельные TTML-контейнеры (par).');
        const range = interval(attrs, parentStart, parentEnd);
        const nested = children(node, tag);
        if (tag === 'head') continue;
        if (tag !== 'p') { visit(nested, range.start, range.end, depth + 1); continue; }
        if (lines.length >= 10000) throw new Error('Слишком много строк TTML.');
        const words: LyricWord[] = [];
        const lineId = `line-${lines.length}`;
        function collect(parts: Node[], start: number, end: number, depth = 0) {
          if (depth > 40) throw new Error('Слишком глубокая вложенность слов TTML.');
          for (const part of parts) {
            if ('#text' in part) {
              const value = String(part['#text']);
              if (value.trim()) words.push({ id: `${lineId}-${words.length}`, text: value, start, end });
              else if (words.length && value) words[words.length - 1].text += ' ';
              continue;
            }
            if ('br' in part) { if (words.length) words[words.length - 1].text += ' '; continue; }
            if ('span' in part) {
              const a = (part[':@'] ?? {}) as Node;
              const r = interval(a, start, end);
              if (a['@_begin'] !== undefined || a['@_end'] !== undefined || a['@_dur'] !== undefined) wordTimed = true;
              collect(children(part, 'span'), r.start, r.end, depth + 1);
            }
          }
        }
        collect(nested, range.start, range.end);
        if (!words.length && textOf(nested).trim()) throw new Error('Неподдерживаемая структура строки TTML.');
        if (!words.length) continue;
        if (!Number.isFinite(range.end)) throw new Error('Задайте end или dur для каждой строки или её контейнера.');
        for (const word of words) if (word.start < range.start || word.start >= range.end || word.end <= word.start) throw new Error('Слово вне интервала строки.');
        lines.push({ id: lineId, ...range, words });
      }
    }
    visit(nodes, 0, Infinity, 0);
    lines.sort((a, b) => a.start - b.start);
    if (!lines.length) throw new Error('В файле нет синхронизированных строк.');
    return { id, lines, timing: wordTimed ? 'word' : 'line' };
  }
}
