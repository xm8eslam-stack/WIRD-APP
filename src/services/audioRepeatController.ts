export type RepeatCounterRef = { current: number };
export type RepeatTargetRef = { current: number | null };

/**
 * Bind repeat completion to mutable refs rather than React state captured by
 * an audio event closure. The same Audio element is reused for each replay.
 */
export function attachAyahRepeatHandler(
  audio: Pick<HTMLAudioElement, 'currentTime' | 'play' | 'onended'>,
  currentRepeatRef: RepeatCounterRef,
  repeatTargetRef: RepeatTargetRef,
  onRepeatCountChange: (count: number) => void,
  onComplete: () => void,
  onPlaybackError?: () => void
): void {
  audio.onended = () => {
    const target = repeatTargetRef.current === null
      ? null
      : Number.isInteger(repeatTargetRef.current) && repeatTargetRef.current > 0
        ? repeatTargetRef.current
        : 1;

    if (target === null || currentRepeatRef.current < target) {
      currentRepeatRef.current += 1;
      onRepeatCountChange(currentRepeatRef.current);
      audio.currentTime = 0;
      void audio.play().catch(() => onPlaybackError?.());
      return;
    }

    currentRepeatRef.current = 1;
    onRepeatCountChange(1);
    onComplete();
  };
}

