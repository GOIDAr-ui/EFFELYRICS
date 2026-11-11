export type IconName = 'play' | 'pause' | 'previous' | 'next' | 'expand' | 'upload' | 'sliders' | 'activity' | 'close' | 'music' | 'check';
const paths: Record<IconName, React.ReactNode> = {
  play: <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>,
  pause: <><path d="M8 5v14M16 5v14" strokeWidth="4"/></>,
  previous: <><path d="M5 5v14"/><path d="m19 5-10 7 10 7Z" fill="currentColor" stroke="none"/></>,
  next: <><path d="M19 5v14"/><path d="m5 5 10 7-10 7Z" fill="currentColor" stroke="none"/></>,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>,
  sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
  activity: <path d="M2 12h5l3-8 4 16 3-8h5"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  music: <><path d="M10 18V5l10-2v13M10 8l10-2"/><ellipse cx="6.5" cy="18" rx="3.5" ry="2.5"/><ellipse cx="16.5" cy="16" rx="3.5" ry="2.5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>; }
