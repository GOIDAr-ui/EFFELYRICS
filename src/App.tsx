import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutomaticResult } from './core/AutomaticLyricsService';
import { PlaybackClock } from './core/PlaybackClock';
import { LyricSyncEngine } from './core/LyricSyncEngine';
import { ImportedLyricsProvider } from './core/LyricsProvider';
import { DEMO_ID, demoLyrics, demoSnapshot } from './core/demo';
import { emptySnapshot, type MediaCommand, type MediaSnapshot, type LyricsDocument } from './core/types';
import { normalizeSnapshot } from './media/normalize';
import { LyricsRenderer } from './components/LyricsRenderer';
import { Icon } from './components/Icon';
const sync = new LyricSyncEngine();
const format = (time: number | null) => time === null ? '—:—' : `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
function readPreferences(): { offset: number; reduceMotion: boolean; quality: 'low' | 'high' } {
  const defaults = { offset: 0, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, quality: 'high' as const };
  try { const p = JSON.parse(localStorage.getItem('aurora:preferences') ?? '{}'); return { offset: typeof p.offset === 'number' && Math.abs(p.offset) <= 10 ? p.offset : 0, reduceMotion: typeof p.reduceMotion === 'boolean' ? p.reduceMotion : defaults.reduceMotion, quality: p.quality === 'low' ? 'low' : 'high' }; } catch { return defaults; }
}
export default function App() {
  const [mode, setMode] = useState<'companion' | 'demo'>('companion');
  const [media, setMedia] = useState<MediaSnapshot>(() => emptySnapshot());
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [lyrics, setLyrics] = useState<LyricsDocument | null>(null);
  const [panel, setPanel] = useState<'diagnostics' | 'settings' | null>(null);
  const [automatic, setAutomatic] = useState<AutomaticResult | null>(null);
  const [searchStatus, setSearchStatus] = useState('Ожидание трека');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const fileInput = useRef<HTMLInputElement>(null);
  const liveClock = useRef(new PlaybackClock());
  const demoClock = useRef(new PlaybackClock());
  const provider = useRef(new ImportedLyricsProvider());
  const importGeneration = useRef(0);
  const current = mode === 'demo' ? { ...demoSnapshot, playback: demoPlaying ? 'playing' as const : 'paused' as const } : media;
  const currentIdentity = useRef({ id: current.trackId, mode });
  currentIdentity.current = { id: current.trackId, mode };
  const clock = mode === 'demo' ? demoClock.current : liveClock.current;
  const selection = sync.select(mode === 'companion' && media.position === null ? null : lyrics, position, preferences.offset);
  const playing = current.playback === 'playing';
  useEffect(() => {
    let active = true, receivedEvent = false;
    const receive = (raw: MediaSnapshot) => {
      if (!active) return;
      const data = normalizeSnapshot(raw);
      liveClock.current.update({ trackId: data.trackId, position: data.position, playing: data.playback === 'playing' && data.position !== null, duration: data.duration, rate: data.rate });
      setMedia(data);
    };
    const unsubscribe = window.aurora?.onSnapshot(data => { receivedEvent = true; receive(data); });
    if (window.aurora) window.aurora.getSnapshot().then(data => { if (!receivedEvent) receive(data); }).catch(() => { if (active) setMedia(emptySnapshot('Не удалось получить данные Windows. Включите деморежим.')); });
    else setMedia(emptySnapshot('В браузере доступен демонстрационный режим. Для Apple Music запустите Windows-приложение.'));
    return () => { active = false; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    let active = true;
    importGeneration.current++;
    setLyrics(mode === 'demo' ? demoLyrics : null);
    setPosition(clock.time());
    if (mode === 'companion') provider.current.load(media.trackId).then(doc => { if (active) setLyrics(doc); });
    return () => { active = false; };
  }, [mode, media.trackId, clock]);
  const timeState = useRef({ clock, mode, known: media.position !== null, offset: preferences.offset });
  timeState.current = { clock, mode, known: media.position !== null, offset: preferences.offset };
  const getLyricTime = useCallback(() => { const s = timeState.current; return s.mode === 'companion' && !s.known ? null : s.clock.time() + s.offset; }, []);
  useEffect(() => {
    if (mode !== 'companion' || !media.trackId) { setAutomatic(null); return; }
    let active = true;
    setAutomatic(null); setSearchStatus('Поиск текста…');
    const generation = importGeneration.current;
    provider.current.load(media.trackId).then(async imported => {
      if (!active || generation !== importGeneration.current) return;
      if (imported) { setLyrics(imported); setSearchStatus('Ручной TTML'); return; }
      if (!media.title || !media.artist || !window.aurora?.findLyrics) { setSearchStatus('Недостаточно метаданных или нужен Electron'); return; }
      try {
        const result = await window.aurora.findLyrics({ title: media.title, artist: media.artist, album: media.album, duration: media.duration });
        if (!active || generation !== importGeneration.current) return;
        setAutomatic(result); setLyrics(result.document); setSearchStatus(result.status === 'found' ? result.source : result.status === 'ambiguous' ? 'Выберите версию текста' : result.status === 'error' ? 'Источник недоступен · импортируйте TTML' : 'Пословный текст не найден');
      } catch { if (active && generation === importGeneration.current) setSearchStatus('Источник недоступен · импортируйте TTML'); }
    });
    return () => { active = false; void window.aurora?.cancelLyrics?.(); };
  }, [mode, media.trackId, media.title, media.artist, media.album, media.duration]);
  async function chooseLyrics(id: string) {
    const binding = currentIdentity.current.id;
    try {
      const result = await window.aurora?.findLyrics?.({ title: media.title!, artist: media.artist!, album: media.album, duration: media.duration }, id);
      if (result && currentIdentity.current.id === binding && currentIdentity.current.mode === 'companion') { setLyrics(result.document); setAutomatic(result); setSearchStatus(result.source || 'Текст недоступен'); }
    } catch { setNotice('Не удалось загрузить выбранный текст'); }
  }
  useEffect(() => {
    if (!playing) { setPosition(clock.time()); return; }
    let frame = 0, last = -Infinity;
    const tick = (now: number) => {
      if (now - last >= (preferences.quality === 'low' ? 1000 / 20 : 1000 / 30)) {
        const time = clock.time();
        setPosition(time); last = now;
        if (mode === 'demo' && time >= 40) { demoClock.current.pause(); setDemoPlaying(false); }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clock, mode, preferences.quality, playing]);
  useEffect(() => { setPosition(clock.time()); }, [clock, mode, media.position, media.playback]);
  useEffect(() => { try { localStorage.setItem('aurora:preferences', JSON.stringify(preferences)); } catch { /* Storage may be disabled. */ } }, [preferences]);
  useEffect(() => {
    if (!current.artwork) { document.documentElement.style.removeProperty('--cover-hue'); return; }
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.drawImage(image, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        document.documentElement.style.setProperty('--cover-hue', `rgb(${r} ${g} ${b})`);
      } catch { /* Keep original palette if cover cannot be sampled. */ }
    };
    image.src = current.artwork;
    return () => { active = false; image.onload = null; };
  }, [current.artwork]);
  function switchMode(next: typeof mode) {
    demoClock.current.pause(); setDemoPlaying(false); setMode(next); setNotice('');
    if (next === 'demo') demoClock.current.update({ trackId: DEMO_ID, position: 0, playing: false, duration: 40 });
  }
  async function command(value: MediaCommand) {
    setNotice('');
    if (mode === 'demo') {
      if (value === 'toggle') { if (demoPlaying) demoClock.current.pause(); else { if (demoClock.current.time() >= 40) demoClock.current.seek(0); demoClock.current.resume(); } setDemoPlaying(!demoPlaying); }
      else { const time = demoClock.current.time(); demoClock.current.seek(value === 'previous' ? Math.max(0, (Math.ceil(time / 5) - 1) * 5) : Math.min(39.9, (Math.floor(time / 5) + 1) * 5)); }
      setPosition(demoClock.current.time()); return;
    }
    if (!window.aurora || pending) return;
    setPending(true);
    try { const result = await window.aurora.command(value); if (!result.ok) setNotice(result.error ?? 'Команда отклонена.'); }
    catch { setNotice('Не удалось отправить команду.'); } finally { setPending(false); }
  }
  async function importFile(browserFile?: File) {
    const binding = { ...currentIdentity.current }, generation = ++importGeneration.current;
    if (!binding.id) { setNotice('Сначала выберите деморежим или запустите трек в Apple Music.'); return; }
    try {
      let imported: { name: string; content: string } | null;
      if (browserFile) {
        if (browserFile.size > 2_000_000) throw new Error('TTML слишком большой (максимум 2 МБ).');
        imported = { name: browserFile.name, content: await browserFile.text() };
      } else if (window.aurora) imported = await window.aurora.importTTML();
      else { fileInput.current?.click(); return; }
      if (!imported) return;
      if (binding.id !== currentIdentity.current.id || binding.mode !== currentIdentity.current.mode || generation !== importGeneration.current) { setNotice('Трек изменился. Повторите импорт для текущей песни.'); return; }
      setLyrics(provider.current.import(binding.id, imported.content)); setSearchStatus('Ручной TTML'); setAutomatic(null); void window.aurora?.cancelLyrics?.();
      setNotice(`Загружен ${imported.name}. Текст привязан к текущему треку.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось открыть TTML.'); }
  }
  async function fullscreen() {
    try { if (window.aurora) await window.aurora.fullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('Полноэкранный режим недоступен.'); }
  }
  const connected = current.connection === 'connected';
  return <div className={`app ${preferences.reduceMotion ? 'reduce-motion' : ''} quality-${preferences.quality}`}>
    <div className="ambient" aria-hidden="true"/><div className="grain" aria-hidden="true"/>
    <header className="topbar">
      <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="Aurora Lyrics"><span className="brand-mark">a<span>✦</span></span><span>Aurora<span className="brand-light"> Lyrics</span><small>APPLE MUSIC COMPANION</small></span></a>
      <div className="mode-switch" aria-label="Источник воспроизведения"><button className={mode === 'companion' ? 'selected' : ''} aria-pressed={mode === 'companion'} onClick={() => switchMode('companion')}><Icon name="music" size={15}/>Apple Music</button><button className={mode === 'demo' ? 'selected' : ''} aria-pressed={mode === 'demo'} onClick={() => switchMode('demo')}>Деморежим<span className="tiny-dot"/></button></div>
      <div className="top-actions"><button className={`icon-button ${panel === 'diagnostics' ? 'chosen' : ''}`} aria-label="Диагностика подключения" title="Диагностика подключения" onClick={() => setPanel(panel === 'diagnostics' ? null : 'diagnostics')}><Icon name="activity"/></button><button className="icon-button" aria-label="Полноэкранный режим" title="Полноэкранный режим" onClick={() => { void fullscreen(); }}><Icon name="expand"/></button></div>
    </header>
    <main className="main-layout">
      <section className="player" aria-label="Проигрыватель">
        <div className="eyebrow"><span className="live-dot"/> {mode === 'demo' ? 'A LITTLE PREVIEW OF THE MAGIC' : 'YOUR MUSIC. A NEW PERSPECTIVE.'}</div>
        <div className="cover-wrap"><div className="cover-shadow"/>{current.artwork ? <img className="album-cover" src={current.artwork} alt="Обложка текущего альбома"/> : mode === 'companion' ? <div className="album-cover neutral-cover" role="img" aria-label="Обложка не передана Windows"><Icon name="music" size={48}/><span>Обложка не передана Windows</span></div> : <div className="album-cover original-cover" role="img" aria-label="Оригинальная абстрактная обложка Aurora: янтарное сияние над фиолетовым горизонтом"><div className="cover-orb"/><div className="cover-horizon"/><span className="cover-label">AURORA STUDIO<span>FIRST LIGHT</span></span><span className="cover-number">01 / ORIGINAL</span></div>}<span className="cover-badge"><Icon name="music" size={13}/>{mode === 'demo' ? 'ORIGINAL DEMO' : 'APPLE MUSIC'}</span></div>
        <div className="track-info"><div><h1>{current.title || (connected ? 'Без названия' : 'В ожидании музыки')}</h1><p>{current.artist || (connected ? 'Неизвестный исполнитель' : 'Ваша музыка появится здесь')}</p></div><span className="audio-wave" aria-hidden="true"><i/><i/><i/><i/></span></div>
        <div className="timeline"><input aria-label="Позиция воспроизведения" type="range" min="0" max={current.duration ?? 1} step="0.01" value={current.duration === null ? 0 : Math.min(position, current.duration)} disabled={mode !== 'demo'} onChange={event => { demoClock.current.seek(+event.target.value); setPosition(+event.target.value); }} style={{ '--progress': `${current.duration ? Math.min(100, position / current.duration * 100) : 0}%` } as React.CSSProperties}/><div className="time-labels"><span>{mode === 'companion' && current.position === null ? '—:—' : format(position)}</span><span>{format(current.duration)}</span></div></div>
        <div className="transport"><button className="icon-button skip" aria-label={mode === 'demo' ? 'Предыдущий фрагмент' : 'Предыдущий трек'} disabled={!current.capabilities.previous || pending} onClick={() => { void command('previous'); }}><Icon name="previous" size={28}/></button><button className="play-button" aria-label={playing ? 'Пауза' : 'Воспроизвести'} disabled={!current.capabilities.toggle || pending} onClick={() => { void command('toggle'); }}><Icon name={playing ? 'pause' : 'play'} size={29}/></button><button className="icon-button skip" aria-label={mode === 'demo' ? 'Следующий фрагмент' : 'Следующий трек'} disabled={!current.capabilities.next || pending} onClick={() => { void command('next'); }}><Icon name="next" size={28}/></button></div>
        <div className={`connection ${connected ? 'online' : ''}`}><span className="status-dot"/>{mode === 'demo' ? 'Демонстрация · без воспроизведения аудио' : connected ? 'Подключено к Apple Music' : 'Apple Music не подключена'}</div>
        {!connected && <button className="demo-offer" onClick={() => switchMode('demo')}>Попробовать деморежим <span>↗</span></button>}
      </section>
      <section className="lyrics-panel" aria-label="Текст песни">
        <div className="lyrics-heading"><span className="eyebrow">LYRICS <span className="heading-line"/></span><span className="timing-tag">{lyrics ? lyrics.timing === 'word' ? 'WORD BY WORD' : 'LINE BY LINE' : 'FEEL EVERY WORD'}</span></div>
        <LyricsRenderer getTime={getLyricTime} document={lyrics} selection={selection} reduceMotion={preferences.reduceMotion}/>
        {mode === 'companion' && <div className="source-status" role="status">{searchStatus} · {lyrics?.timing === 'word' ? 'WORD' : lyrics ? 'LINE' : 'NONE'}{automatic?.status === 'ambiguous' && <select aria-label="Версия текста" defaultValue="" onChange={e => { void chooseLyrics(e.target.value); }}><option value="" disabled>Выберите версию</option>{automatic.candidates.map(c => <option key={c.id} value={c.id}>{c.title} · {c.artist} · {c.album} · {c.source}</option>)}</select>}</div>}
        <div className="lyrics-caption"><span className="spark">✦</span>{mode === 'demo' ? 'Оригинальный текст. Создан для Aurora.' : current.position === null && connected ? 'Windows не передаёт позицию — синхронизация недоступна.' : 'Текст следует за музыкой. В вашем ритме.'}</div>
      </section>
    </main>
    <footer className="bottom-bar"><div className="footer-note"><span className="footer-spark">✦</span>Less noise. More feeling.<span className="version">v0.1.1 — First light</span></div><div className="footer-actions"><button className="text-button" onClick={() => { void importFile(); }}><Icon name="upload" size={16}/>Импорт TTML</button><span className="divider"/><button className={`text-button ${panel === 'settings' ? 'chosen' : ''}`} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}><Icon name="sliders" size={16}/>Настройки</button></div></footer>
    <input ref={fileInput} type="file" accept=".ttml,.xml" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }}/>
    {notice && <div className="notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
    {panel && <aside className="utility-panel" aria-label={panel === 'settings' ? 'Настройки' : 'Диагностика'}><div className="panel-title"><h2>{panel === 'settings' ? 'Настройки' : 'Диагностика сессии'}</h2><button className="icon-button" aria-label="Закрыть панель" onClick={() => setPanel(null)}><Icon name="close"/></button></div>{panel === 'settings' ? <>
      <p className="panel-description">Подстройте текст под свой ритм.</p>
      <label className="setting">Смещение текста <strong>{preferences.offset > 0 ? '+' : ''}{preferences.offset.toFixed(1)} с</strong><input aria-label="Смещение текста" type="range" min="-10" max="10" step="0.1" value={preferences.offset} onChange={e => setPreferences({ ...preferences, offset: +e.target.value })}/><small>Положительное значение показывает текст раньше.</small></label>
      <label className="check-setting"><span>Уменьшить движение<small>Отключить декоративные переходы</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={e => setPreferences({ ...preferences, reduceMotion: e.target.checked })}/></label>
      <label className="setting">Качество визуализации<select aria-label="Качество визуализации" value={preferences.quality} onChange={e => setPreferences({ ...preferences, quality: e.target.value as 'low' | 'high' })}><option value="high">Высокое · 30 кадров/с</option><option value="low">Экономное · 20 кадров/с</option></select></label>
      <p className="panel-description">Эффекты смысла слов появятся в следующих версиях. В v0.1 работает независимая пословная синхронизация.</p>
    </> : <>
      <span className="diagnostic-tag">РЕАЛЬНЫЕ ДАННЫЕ WINDOWS · НЕ ДЕМО</span><p className="panel-description">{media.message ?? 'Данные получены через GSMTC.'}</p>
      <dl>{Object.entries({ 'Источник текста': mode === 'demo' ? 'Demo' : searchStatus, 'Поиск': automatic?.status ?? '—', 'Строки': String(lyrics?.lines.length ?? 0), 'Слова': String(lyrics?.lines.reduce((n,l) => n+l.words.length,0) ?? 0), 'Синхронизация': lyrics?.timing.toUpperCase() ?? 'NONE', 'Текущее слово': lyrics?.lines[selection.lineIndex]?.words[selection.wordIndex]?.text ?? '—', 'Fill': String(Math.round(Number(document.querySelector('.word.current')?.getAttribute('data-progress') ?? 0)*100))+'%', 'Offset': String(preferences.offset), 'Соединение': media.connection, 'Источник': media.sourceId ?? '—', 'Трек': media.title ?? '—', 'Исполнитель': media.artist ?? '—', 'Альбом': media.album ?? '—', 'Обложка': media.artwork ? 'Доступна' : 'Не передана', 'Состояние': media.playback, 'Позиция': media.position === null ? 'Не передана' : `${media.position.toFixed(2)} с`, 'Длительность': format(media.duration), 'Возраст timeline': `${media.timelineAge.toFixed(2)} с`, 'Play/Pause': String(media.capabilities.toggle), 'Next': String(media.capabilities.next), 'Previous': String(media.capabilities.previous), 'Сессии': media.sessions.join(', ') || 'Нет', 'ID трека': media.trackId || '—' }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    </>}</aside>}
  </div>;
}
