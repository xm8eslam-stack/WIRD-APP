import {
  QuranAudioQueueController,
  type QuranAudioElement,
  type QuranAudioTrack
} from './audioQueueController';

class MockQuranAudio implements QuranAudioElement {
  currentTime = 0;
  playbackRate = 1;
  preload = '';
  onended: ((event?: Event) => void) | null = null;
  onerror: ((event?: Event) => void) | null = null;
  onplaying: ((event?: Event) => void) | null = null;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  constructor(readonly url: string) {}
  play(): Promise<void> { this.playCalls += 1; return Promise.resolve(); }
  pause(): void { this.pauseCalls += 1; }
  load(): void { this.loadCalls += 1; }
  finish(): void { this.onended?.(new Event('ended')); }
}

export async function runQuranAudioQueueControllerTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name + ': ' + (error instanceof Error ? error.message : String(error))); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const tracks: QuranAudioTrack[] = [
    { id: '1:1', url: '/audio/001001.mp3' },
    { id: '1:2', url: '/audio/001002.mp3' },
    { id: '1:3', url: '/audio/001003.mp3' },
    { id: '1:4', url: '/audio/001004.mp3' }
  ];

  await test('preloads the next ayah before the current file ends and advances automatically', async () => {
    const audios: MockQuranAudio[] = [];
    const changes: number[] = [];
    let completed = 0;
    const queue = new QuranAudioQueueController({
      onTrackChange: index => changes.push(index),
      onComplete: () => { completed += 1; }
    }, url => {
      const audio = new MockQuranAudio(url);
      audios.push(audio);
      return audio;
    });

    queue.start({ tracks, startIndex: 0, endIndex: 2, repeatCount: 1, playbackRate: 1.25 });
    assert(audios.length === 2 && audios[1].loadCalls === 1, 'The next ayah should be preloaded immediately');
    assert(audios[0].playCalls === 1 && audios[0].playbackRate === 1.25, 'The first ayah should start at the selected rate');
    audios[0].finish();
    await Promise.resolve();
    assert(queue.getState().currentIndex === 1, 'Playback should advance to the second ayah');
    assert(audios[1].playCalls === 1, 'The preloaded second ayah should play');
    assert(audios.length === 3, 'The third ayah should be preloaded while the second plays');
    audios[1].finish();
    await Promise.resolve();
    audios[2].finish();
    assert(completed === 1 && !queue.getState().active, 'The queue should complete exactly once');
    assert(changes.join(',') === '0,1,2', 'Track changes should stay in Quran order');
  });

  await test('repeats only the selected bounded segment for the configured number of cycles', async () => {
    const audios: MockQuranAudio[] = [];
    const changes: Array<[number, number]> = [];
    let completed = 0;
    const queue = new QuranAudioQueueController({
      onTrackChange: (index, cycle) => changes.push([index, cycle]),
      onComplete: () => { completed += 1; }
    }, url => {
      const audio = new MockQuranAudio(url);
      audios.push(audio);
      return audio;
    });

    queue.start({ tracks, startIndex: 1, endIndex: 2, repeatCount: 2 });
    audios[0].finish();
    await Promise.resolve();
    audios[1].finish();
    await Promise.resolve();
    audios[2].finish();
    await Promise.resolve();
    audios[3].finish();

    assert(changes.map(([index]) => index).join(',') === '1,2,1,2', 'The queue must not play tracks outside the selected segment');
    assert(changes.map(([, cycle]) => cycle).join(',') === '1,1,2,2', 'Each segment repetition must increment the cycle');
    assert(completed === 1, 'The selected segment should finish after exactly two cycles');
  });

  await test('supports infinite segment repetition and stops without stale ended handlers', async () => {
    const audios: MockQuranAudio[] = [];
    const queue = new QuranAudioQueueController({}, url => {
      const audio = new MockQuranAudio(url);
      audios.push(audio);
      return audio;
    });
    queue.start({ tracks, startIndex: 0, endIndex: 0, repeatCount: null });
    audios[0].finish();
    await Promise.resolve();
    assert(queue.getState().cycle === 2 && audios[1].playCalls === 1, 'Infinite repeat should begin a second cycle');
    const staleEnded = audios[1].onended;
    queue.stop();
    assert(audios[1].onended === null && audios[1].pauseCalls > 0, 'Stop should detach and release the current audio');
    staleEnded?.(new Event('ended'));
    assert(!queue.getState().active, 'A stale event must not restart a stopped queue');
  });

  await test('pause and resume preserve the current track and playback rate', async () => {
    const audios: MockQuranAudio[] = [];
    const queue = new QuranAudioQueueController({}, url => {
      const audio = new MockQuranAudio(url);
      audios.push(audio);
      return audio;
    });
    queue.start({ tracks, startIndex: 0, endIndex: 1 });
    queue.pause();
    assert(queue.getState().paused && audios[0].pauseCalls === 1, 'Pause should retain the current queue position');
    queue.setPlaybackRate(1.5);
    queue.resume();
    await Promise.resolve();
    assert(!queue.getState().paused && audios[0].playCalls === 2, 'Resume should reuse the current audio element');
    assert(audios[0].playbackRate === 1.5 && audios[1].playbackRate === 1.5, 'Rate changes should apply to current and preloaded audio');
    queue.stop();
  });

  await test('rejects invalid segment bounds without creating audio', () => {
    const audios: MockQuranAudio[] = [];
    const queue = new QuranAudioQueueController({}, url => {
      const audio = new MockQuranAudio(url);
      audios.push(audio);
      return audio;
    });
    let threw = false;
    try { queue.start({ tracks, startIndex: 3, endIndex: 1 }); }
    catch (error) { threw = error instanceof RangeError; }
    assert(threw && audios.length === 0, 'Invalid segment bounds must fail before audio allocation');
  });

  return { passed, failed };
}
