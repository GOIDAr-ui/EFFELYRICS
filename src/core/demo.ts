import type { LyricsDocument, MediaSnapshot } from './types';
export const DEMO_ID = 'aurora-original-demo-v1';
const verses = [
  ['Там, где город засыпает,', 0], ['Мы рисуем новый свет.', 5],
  ['Тихий ветер поднимает', 10], ['Наш оставленный секрет.', 15],
  ['И над крышами сияет', 20], ['Небо цвета янтаря.', 25],
  ['Каждый шаг нас приближает', 30], ['К свету нового дня.', 35],
] as const;
export const demoLyrics: LyricsDocument = {
  id: DEMO_ID, timing: 'word', lines: verses.map(([line, start], i) => {
    const parts = line.split(' '), step = 4.6 / parts.length;
    return { id: `demo-line-${i}`, start, end: start + 5, words: parts.map((text, j) => ({ id: `demo-word-${i}-${j}`, text: text + (j === parts.length - 1 ? '' : ' '), start: start + j * step, end: start + (j + 1) * step })) };
  }),
};
export const demoSnapshot: MediaSnapshot = {
  connection: 'connected', sourceId: 'Aurora Demo', trackId: DEMO_ID,
  title: 'К свету нового дня', artist: 'Aurora Studio', album: 'First light · Original demo',
  playback: 'paused', position: 0, duration: 40, rate: 1, timelineAge: 0,
  capabilities: { toggle: true, next: true, previous: true }, sessions: ['Aurora Demo'],
};
