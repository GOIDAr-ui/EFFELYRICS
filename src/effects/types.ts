import type { LyricsDocument } from '../core/types';
export interface EffectSettings { intensity: number; speed: number; duration: number; quality: 'low' | 'high'; reduceMotion: boolean }
export interface EffectDefinition { id: string; name: string; version: number; defaults: EffectSettings }
export interface WordEffectAssignment { wordId: string; effectId: string; origin: 'manual' | 'analyzer'; settings: Partial<EffectSettings>; context?: string; confidence?: number }
export interface EffectTimeline { trackId: string; revision: number; assignments: WordEffectAssignment[] }
export interface SemanticAnalyzer { analyze(document: LyricsDocument, language: 'ru' | 'en', signal: AbortSignal): Promise<WordEffectAssignment[]> }
export interface EffectRegistry { register(definition: EffectDefinition): void; get(id: string): EffectDefinition | undefined; list(): readonly EffectDefinition[] }
/** Receives playback time; it must never advance the lyric clock. */
export interface VisualEffectRenderer {
  mount(canvas: HTMLCanvasElement): void;
  render(time: number, timeline: EffectTimeline, settings: EffectSettings): void;
  reset(trackId: string): void;
  dispose(): void;
}
export interface EffectTimelineStore { load(trackId: string): Promise<EffectTimeline | null>; save(timeline: EffectTimeline): Promise<void> }
export type WindowMode = 'windowed' | 'fullscreen' | 'compact';
export interface WidgetLayout { id: string; kind: 'lyrics' | 'artwork' | 'transport'; x: number; y: number; width: number; height: number }
