import { memo, useEffect, useRef, useMemo } from 'react';
import { graphemes, letterLight, lineLight } from '../core/illumination';
import { fillProgress } from '../core/fill';
import type { LyricsDocument } from '../core/types';
import type { LyricSelection } from '../core/LyricSyncEngine';
export const LyricsRenderer = memo(function LyricsRenderer({ document, selection, reduceMotion, getTime }: { document: LyricsDocument | null; selection: LyricSelection; reduceMotion: boolean; getTime: () => number | null }) {
  const segments = useMemo(() => new Map(document?.lines.flatMap(line => line.words.map(word => [word.id, graphemes(word.text)] as const)) ?? []), [document]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const line = root.current?.querySelector(`[data-line="${selection.lineIndex}"]`);
    line?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'instant' : 'smooth' });
  }, [selection.lineIndex, reduceMotion, document?.id]);
  const timeRef = useRef(getTime); timeRef.current = getTime;
  useEffect(() => {
    const words = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-word-id]') ?? []).map(element => ({ element, start: Number(element.dataset.start), end: Number(element.dataset.end), letters: Array.from(element.querySelectorAll<HTMLElement>('[data-letter]')) }));
    const lines = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-line]') ?? []);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let previousReduced: boolean | undefined;
    let frame = 0, last = -Infinity; let previous: number | null | undefined; let previousTime: number | null = null;
    const update = (now: number) => {
      if (now - last >= 1000 / 60 && root.current && document) {
        last = now; const time = timeRef.current();
        const reduced = reduceMotion || media.matches;
        if (time === previous && reduced === previousReduced) { frame = requestAnimationFrame(update); return; } previous = time; previousReduced = reduced;
        words.forEach(({ element, start, end, letters }) => {
          element.dataset.progress = String(time === null ? 0 : fillProgress(time, start, end));
          const phase = time === null || time < start ? 'waiting' : time < end ? 'active' : 'sung';
          // Settled words need no per-letter writes until a seek changes their phase.
          if (element.dataset.phase === phase && (phase === 'waiting' || (phase === 'sung' && time !== null && time >= end+.3 && previousTime !== null && previousTime >= end+.3))) return;
          element.dataset.phase = phase;
          letters.forEach((letter, index) => {
            const light = letterLight(time, start, end, index, letters.length, reduced);
            letter.style.setProperty('--brightness', String(light.brightness));
            letter.style.setProperty('--glow', String(light.glow));
            letter.dataset.brightness = String(light.brightness);
          });
        });
        lines.forEach((line, index) => { const timing = document.lines[index]; line.style.setProperty('--line-light', String(lineLight(time, timing.start, timing.end))); });
        previousTime = time;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, [document, reduceMotion]);
  if (!document) return <div className="lyrics-empty"><span className="empty-symbol">♫</span><h2>У каждой песни<br/>есть своя история.</h2><p>Импортируйте TTML для текущего трека<br/>или исследуйте оригинальный демотекст.</p></div>;
  return <div className="lyrics-scroll" ref={root} aria-label="Синхронизированный текст" tabIndex={0}>
    <div className="lyrics-spacer"/>
    {document.lines.map((line, index) => <p data-line={index} key={line.id} className={`lyric-line ${index === selection.lineIndex ? 'active' : ''} ${index < selection.lineIndex ? 'past' : ''}`}>
      {line.words.map((word, wi) => <span key={word.id} data-word-id={word.id} data-start={word.start} data-end={word.end} className={index === selection.lineIndex && (document.timing === 'line' || wi === selection.wordIndex) ? 'word current' : index === selection.lineIndex && wi < selection.wordIndex ? 'word sung' : 'word'}><span className="word-text">{word.text}</span><span className="word-fill" aria-hidden="true">{segments.get(word.id)?.map((segment, i) => /\S/u.test(segment) ? <span className="lyric-letter" data-letter={i} key={i}>{segment}</span> : segment)}</span></span>)}
    </p>)}
    <div className="lyrics-spacer"/>
  </div>;
}, (a,b) => a.document === b.document && a.selection.lineIndex === b.selection.lineIndex && a.selection.wordIndex === b.selection.wordIndex && a.reduceMotion === b.reduceMotion && a.getTime === b.getTime);
