export interface QuranAudioTrack {
  id: string;
  url: string;
}

export type QuranAudioRepeatCount = number | null;

export interface QuranAudioQueueOptions {
  tracks: QuranAudioTrack[];
  startIndex?: number;
  endIndex?: number;
  /** Total segment plays; null means repeat until stopped. */
  repeatCount?: QuranAudioRepeatCount;
  playbackRate?: number;
}

export interface QuranAudioQueueCallbacks {
  onTrackChange?: (index: number, cycle: number) => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onComplete?: () => void;
  onError?: (error?: unknown) => void;
}

export interface QuranAudioElement {
  currentTime: number;
  playbackRate: number;
  preload: string;
  onended: ((event?: Event) => void) | null;
  onerror: ((event?: Event) => void) | null;
  onplaying: ((event?: Event) => void) | null;
  play: () => Promise<void>;
  pause: () => void;
  load?: () => void;
}

export type QuranAudioFactory = (url: string) => QuranAudioElement;

interface QueuePosition {
  index: number;
  cycle: number;
}

/**
 * Plays a bounded Quran ayah segment in sequence while preloading the next
 * track. Preloading reduces artificial gaps between separate MP3 files; it
 * does not claim sample-accurate gapless playback when source files contain
 * encoded silence or the browser/network cannot buffer the next file in time.
 */
export class QuranAudioQueueController {
  private readonly createAudio: QuranAudioFactory;
  private readonly callbacks: QuranAudioQueueCallbacks;
  private tracks: QuranAudioTrack[] = [];
  private startIndex = 0;
  private endIndex = -1;
  private repeatCount: QuranAudioRepeatCount = 1;
  private playbackRate = 1;
  private currentIndex = -1;
  private currentCycle = 1;
  private currentAudio: QuranAudioElement | null = null;
  private nextAudio: QuranAudioElement | null = null;
  private nextPosition: QueuePosition | null = null;
  private generation = 0;
  private active = false;
  private paused = false;

  constructor(
    callbacks: QuranAudioQueueCallbacks = {},
    createAudio: QuranAudioFactory = url => new Audio(url)
  ) {
    this.callbacks = callbacks;
    this.createAudio = createAudio;
  }

  start(options: QuranAudioQueueOptions): void {
    this.stop();
    if (!Array.isArray(options.tracks) || options.tracks.length === 0) {
      throw new Error('لا توجد مقاطع صوتية صالحة للتشغيل.');
    }

    const startIndex = options.startIndex ?? 0;
    const endIndex = options.endIndex ?? options.tracks.length - 1;
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) ||
        startIndex < 0 || endIndex < startIndex || endIndex >= options.tracks.length) {
      throw new RangeError('نطاق المقطع الصوتي غير صالح.');
    }

    this.tracks = options.tracks.slice();
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.repeatCount = options.repeatCount === null
      ? null
      : Number.isInteger(options.repeatCount) && options.repeatCount > 0
        ? options.repeatCount
        : 1;
    this.playbackRate = Number.isFinite(options.playbackRate) && options.playbackRate! > 0
      ? options.playbackRate!
      : 1;
    this.active = true;
    this.paused = false;
    this.currentCycle = 1;
    this.playTrack(startIndex, 1, null, this.generation);
  }

  pause(): void {
    if (!this.active || this.paused) return;
    this.paused = true;
    this.currentAudio?.pause();
    this.callbacks.onPaused?.();
  }

  resume(): void {
    if (!this.active || !this.paused || !this.currentAudio) return;
    this.paused = false;
    const audio = this.currentAudio;
    const generation = this.generation;
    audio.play().then(() => {
      if (this.active && generation === this.generation && audio === this.currentAudio) {
        this.callbacks.onPlaying?.();
      }
    }).catch(error => this.fail(error, generation, audio));
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) return;
    this.playbackRate = rate;
    if (this.currentAudio) this.currentAudio.playbackRate = rate;
    if (this.nextAudio) this.nextAudio.playbackRate = rate;
  }

  stop(): void {
    this.generation += 1;
    this.active = false;
    this.paused = false;
    this.release(this.currentAudio);
    this.release(this.nextAudio);
    this.currentAudio = null;
    this.nextAudio = null;
    this.nextPosition = null;
    this.tracks = [];
    this.currentIndex = -1;
    this.currentCycle = 1;
  }

  getState(): { active: boolean; paused: boolean; currentIndex: number; cycle: number } {
    return {
      active: this.active,
      paused: this.paused,
      currentIndex: this.currentIndex,
      cycle: this.currentCycle
    };
  }

  private getNextPosition(): QueuePosition | null {
    if (this.currentIndex < this.endIndex) {
      return { index: this.currentIndex + 1, cycle: this.currentCycle };
    }
    if (this.repeatCount === null || this.currentCycle < this.repeatCount) {
      return { index: this.startIndex, cycle: this.currentCycle + 1 };
    }
    return null;
  }

  private makeAudio(index: number): QuranAudioElement {
    const audio = this.createAudio(this.tracks[index].url);
    audio.preload = 'auto';
    audio.playbackRate = this.playbackRate;
    try { audio.load?.(); } catch { /* play() remains the authoritative load result */ }
    return audio;
  }

  private prepareNext(): void {
    const position = this.getNextPosition();
    if (!position) {
      this.release(this.nextAudio);
      this.nextAudio = null;
      this.nextPosition = null;
      return;
    }
    if (this.nextAudio && this.nextPosition?.index === position.index &&
        this.nextPosition.cycle === position.cycle) return;

    this.release(this.nextAudio);
    this.nextAudio = this.makeAudio(position.index);
    this.nextPosition = position;
  }

  private playTrack(
    index: number,
    cycle: number,
    prepared: QuranAudioElement | null,
    generation: number
  ): void {
    if (!this.active || generation !== this.generation) return;
    const previous = this.currentAudio;
    if (previous && previous !== prepared) this.release(previous);

    const audio = prepared || this.makeAudio(index);
    this.currentAudio = audio;
    this.currentIndex = index;
    this.currentCycle = cycle;
    this.paused = false;
    audio.onended = () => {
      if (!this.active || generation !== this.generation || this.currentAudio !== audio) return;
      this.advance(generation);
    };
    audio.onerror = () => this.fail(undefined, generation, audio);
    audio.onplaying = () => {
      if (this.active && generation === this.generation && this.currentAudio === audio) {
        this.callbacks.onPlaying?.();
      }
    };

    this.callbacks.onTrackChange?.(index, cycle);
    this.prepareNext();
    audio.play().then(() => {
      if (this.active && generation === this.generation && this.currentAudio === audio) {
        this.callbacks.onPlaying?.();
      }
    }).catch(error => this.fail(error, generation, audio));
  }

  private advance(generation: number): void {
    const next = this.getNextPosition();
    if (!next) {
      this.active = false;
      this.paused = false;
      this.release(this.currentAudio);
      this.release(this.nextAudio);
      this.currentAudio = null;
      this.nextAudio = null;
      this.nextPosition = null;
      this.callbacks.onComplete?.();
      return;
    }

    const prepared = this.nextPosition?.index === next.index &&
      this.nextPosition.cycle === next.cycle ? this.nextAudio : null;
    if (this.nextAudio && this.nextAudio !== prepared) this.release(this.nextAudio);
    this.nextAudio = null;
    this.nextPosition = null;
    this.playTrack(next.index, next.cycle, prepared, generation);
  }

  private fail(error: unknown, generation: number, audio: QuranAudioElement): void {
    if (!this.active || generation !== this.generation || this.currentAudio !== audio) return;
    this.active = false;
    this.paused = false;
    this.release(this.currentAudio);
    this.release(this.nextAudio);
    this.currentAudio = null;
    this.nextAudio = null;
    this.nextPosition = null;
    this.callbacks.onError?.(error);
  }

  private release(audio: QuranAudioElement | null): void {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    try { audio.pause(); } catch { /* best-effort release */ }
  }
}
