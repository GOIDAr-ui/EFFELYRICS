import { SeekController } from '../src/core/SeekController';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { emptySnapshot, type MediaCommand, type MediaSnapshot, type CommandResult } from '../src/core/types';
import { normalizeSnapshot } from '../src/media/normalize';
export class WindowsMediaSessionAdapter extends EventEmitter {
  snapshot: MediaSnapshot = emptySnapshot();
  private seeks = new SeekController(this.snapshot, (position, trackId) => this.send('seek', { position, trackId }));
  seek(position: number) { return this.seeks.request(position); }
  private child?: ChildProcessWithoutNullStreams;
  private serial = 0;
  private pending = new Map<number, { resolve: (result: CommandResult) => void; timer: ReturnType<typeof setTimeout> }>();
  start(executable: string) {
    if (process.platform !== 'win32') { this.publish(emptySnapshot('Windows Media Session доступна только в Windows. Включите деморежим.')); return; }
    if (this.child) return;
    const child = spawn(executable, [], { windowsHide: true, shell: false, stdio: 'pipe' });
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    // Consume stderr without exposing OS metadata or accumulating output.
    child.stderr.resume();
    let bufferBytes = 0;
    child.stdout.on('data', chunk => {
      bufferBytes = chunk.includes(10) ? 0 : bufferBytes + chunk.length;
      if (bufferBytes > 4_000_000) { child.kill(); this.publish(emptySnapshot('Слишком большой ответ Windows-моста.')); }
    });
    lines.on('line', line => {
      if (line.length > 4_000_000) return;
      try {
        const value = JSON.parse(line);
        if (value.kind === 'result' && Number.isInteger(value.id)) {
          const request = this.pending.get(value.id);
          if (request) { clearTimeout(request.timer); this.pending.delete(value.id); request.resolve({ ok: value.ok === true, error: typeof value.error === 'string' ? value.error.slice(0, 500) : undefined }); }
        } else if (value.kind === 'snapshot') {
          const snapshot = normalizeSnapshot(value.data);
          if (value.data?.artworkChanged === false && snapshot.trackId === this.snapshot.trackId) snapshot.artwork = this.snapshot.artwork;
          this.publish(snapshot);
        }
      } catch { this.publish(emptySnapshot('Windows-мост вернул некорректный JSON.')); }
    });
    child.on('error', () => this.publish(emptySnapshot('Windows-мост не запустился. Соберите его по инструкции или включите деморежим.')));
    child.on('exit', () => {
      lines.close(); this.child = undefined;
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.resolve({ ok: false, error: 'Windows-мост остановлен.' }); }
      this.pending.clear(); this.publish(emptySnapshot('Windows-мост остановлен. Перезапустите приложение или включите деморежим.'));
    });
    child.stdin.on('error', () => { /* Exit handler settles outstanding commands. */ });
  }
  private publish(snapshot: MediaSnapshot) { this.snapshot = snapshot; this.seeks.observe(snapshot); this.emit('snapshot', snapshot); }
  command(command: MediaCommand): Promise<CommandResult> {
    if (!this.child?.stdin.writable || !this.snapshot.capabilities[command]) return Promise.resolve({ ok: false, error: 'Команда недоступна в текущей сессии.' });
    return this.send(command);
  }
  private send(command: string, extra: Record<string, unknown> = {}): Promise<CommandResult> {
    if (!this.child?.stdin.writable) return Promise.resolve({ ok: false, error: 'Windows-мост недоступен.' });
    const id = ++this.serial;
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve({ ok: false, error: 'Apple Music не ответила на команду.' }); }, 5000);
      this.pending.set(id, { resolve, timer });
      this.child!.stdin.write(JSON.stringify({ id, command, ...extra }) + '\n');
    });
  }
  dispose() { this.seeks.dispose(); this.child?.kill(); }
}
