import type { MediaSnapshot, CommandResult } from './types';
export function seekTarget(value: number, duration: number | null): number | null {
  return duration !== null && Number.isFinite(duration) && duration > 0 && Number.isFinite(value) ? Math.max(0, Math.min(duration, value)) : null;
}
export interface SeekResult extends CommandResult { status: 'confirmed' | 'rejected' | 'unconfirmed' | 'superseded'; requested: number; actual: number | null }
/** Acceptance alone never confirms a seek. Only a fresh system timeline does. */
export class SeekController {
  private snapshot: MediaSnapshot;
  private pending?: { track: string; target: number; baseline: number; accepted: boolean; resolve: (r: SeekResult) => void; timer: ReturnType<typeof setTimeout> };
  constructor(initial: MediaSnapshot, private send: (position: number, track: string) => Promise<CommandResult>, private timeout = 5000) { this.snapshot = initial; }
  private finish(status: SeekResult['status'], error?: string) {
    const p = this.pending; if (!p) return; this.pending = undefined; clearTimeout(p.timer);
    p.resolve({ ok: status === 'confirmed', status, error, requested: p.target, actual: this.snapshot.position });
  }
  observe(snapshot: MediaSnapshot) {
    this.snapshot = snapshot; const p = this.pending; if (!p) return;
    if (snapshot.trackId !== p.track || snapshot.connection !== 'connected') { this.finish('rejected', 'Трек или сессия изменились.'); return; }
    if (p.accepted && snapshot.position !== null && (snapshot.timelineUpdatedAt ?? 0) > p.baseline && Math.abs(snapshot.position - p.target) <= 1.5) this.finish('confirmed');
  }
  request(value: number): Promise<SeekResult> {
    this.finish('superseded', 'Запрошена новая позиция.');
    const target = seekTarget(value, this.snapshot.duration);
    if (target === null || this.snapshot.seekSupported !== true || this.snapshot.connection !== 'connected') return Promise.resolve({ ok: false, status: 'rejected', requested: value, actual: this.snapshot.position, error: 'Системная перемотка недоступна или длительность неизвестна.' });
    return new Promise(resolve => {
      const p = { track: this.snapshot.trackId, target, baseline: this.snapshot.timelineUpdatedAt ?? 0, accepted: false, resolve, timer: setTimeout(() => { if (this.pending === p) this.finish('unconfirmed', 'Apple Music не подтвердила новую позицию.'); }, this.timeout) };
      this.pending = p;
      this.send(target, p.track).then(result => {
        if (this.pending !== p) return;
        if (!result.ok) this.finish('rejected', result.error ?? 'Системная команда отклонена.');
        else { p.accepted = true; this.observe(this.snapshot); }
      }).catch(() => { if (this.pending === p) this.finish('rejected', 'Ошибка IPC при перемотке.'); });
    });
  }
  dispose() { this.finish('rejected', 'Соединение с мостом закрыто.'); }
}
