import { useEffect, useRef } from 'react';
import type { LyricsDocument } from '../core/types';
import type { LyricSelection } from '../core/LyricSyncEngine';
export function LyricsRenderer({ document, selection, reduceMotion }: { document: LyricsDocument | null; selection: LyricSelection; reduceMotion: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const line = root.current?.querySelector(`[data-line="${selection.lineIndex}"]`);
    line?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'instant' : 'smooth' });
  }, [selection.lineIndex, reduceMotion, document?.id]);
  if (!document) return <div className="lyrics-empty"><span className="empty-symbol">♫</span><h2>У каждой песни<br/>есть своя история.</h2><p>Импортируйте TTML для текущего трека<br/>или исследуйте оригинальный демотекст.</p></div>;
  return <div className="lyrics-scroll" ref={root} aria-label="Синхронизированный текст" tabIndex={0}>
    <div className="lyrics-spacer"/>
    {document.lines.map((line, index) => <p data-line={index} key={line.id} className={`lyric-line ${index === selection.lineIndex ? 'active' : ''} ${index < selection.lineIndex ? 'past' : ''}`}>
      {line.words.map((word, wi) => <span key={word.id} className={index === selection.lineIndex && (document.timing === 'line' || wi === selection.wordIndex) ? 'word current' : index === selection.lineIndex && wi < selection.wordIndex ? 'word sung' : 'word'}>{word.text}</span>)}
    </p>)}
    <div className="lyrics-spacer"/>
  </div>;
}
