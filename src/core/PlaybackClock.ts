/** Playback time is authoritative. Rendering frequency never advances this clock. */
export class PlaybackClock {
  private position = 0;
  private anchor = 0;
  private playing = false;
  private rate = 1;
  private duration: number | null = null;
  private trackId = '';
  constructor(private readonly now: () => number = () => performance.now() / 1000) {}
  update(input: { trackId: string; position: number | null; playing: boolean; duration: number | null; rate?: number }) {
    const current = input.trackId === this.trackId ? this.time() : 0;
    this.trackId = input.trackId;
    this.position = input.position ?? current;
    this.anchor = this.now();
    this.playing = input.playing;
    this.duration = input.duration;
    this.rate = Number.isFinite(input.rate) ? input.rate! : 1;
  }
  time(): number {
    const time = Math.max(0, this.position + (this.playing ? (this.now() - this.anchor) * this.rate : 0));
    return this.duration === null ? time : Math.min(this.duration, time);
  }
  seek(time: number) { this.position = Math.max(0, time); this.anchor = this.now(); }
  pause() { this.position = this.time(); this.anchor = this.now(); this.playing = false; }
  resume() { this.anchor = this.now(); this.playing = true; }
}
