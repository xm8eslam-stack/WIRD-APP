import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { OfflineQuranAudioCacheAdapter } from './offlineQuranAudioCache';
import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';
import { OfflineQuranAudioDownloader } from './offlineQuranAudioDownloader';
import { OfflineQuranAudioLibrary } from './offlineQuranAudioLibrary';

class MemoryCache {
  private entries = new Map<string, Response>();
  async match(request: Request): Promise<Response | undefined> {
    return this.entries.get(request.url)?.clone();
  }
  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response.clone());
  }
  async delete(request: Request): Promise<boolean> {
    return this.entries.delete(request.url);
  }
}
class MemoryCacheStorage {
  readonly cache = new MemoryCache();
  async open(): Promise<Cache> { return this.cache as unknown as Cache; }
}
function makeResponse(type = 'audio/mpeg'): Response {
  return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': type } });
}
function abortError(): Error { const error = new Error('aborted'); error.name = 'AbortError'; return error; }

export async function runOfflineQuranAudioDownloaderTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let index = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name, error); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const create = (fetchImpl: typeof fetch, concurrency: 1 | 2 = 2) => {
    const library = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: 'wird-audio-downloader-test-' + (++index)
    });
    const cacheStorage = new MemoryCacheStorage();
    const cache = new OfflineQuranAudioCacheAdapter({
      cacheStorage: cacheStorage as unknown as CacheStorage,
      origin: 'https://wird.test'
    });
    const downloader = new OfflineQuranAudioDownloader(library, cache, {
      fetchImpl,
      concurrency,
      now: () => 500
    });
    return { library, cache, downloader };
  };
  const range = { reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 3 };

  await test('downloads bounded approved audio, verifies Cache Storage, then commits metadata and progress', async () => {
    let maxActive = 0;
    let active = 0;
    const { library, cache, downloader } = create(async (input, init) => {
      assert(init?.redirect === 'error' && init.credentials === 'omit' && init.cache === 'no-store',
        'Downloader must reject redirects and avoid credentialed/network cache reuse');
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      return makeResponse();
    });
    try {
      const job = await library.createJob(range, 100);
      const completed = await downloader.download(job.id);
      const files = await library.listFiles();
      assert(completed.status === 'completed' && completed.completedAyahs === 3, 'All requested ayahs should complete');
      assert(files.length === 3 && files.every(file => file.available && file.verified), 'Only verified files should be recorded');
      for (const file of files) assert(await cache.hasVerifiedFile(file), 'Each metadata record must have a matching verified cache generation');
      assert(maxActive <= 2, 'Downloader must never exceed its bounded concurrency');
    } finally { library.close(); }
  });

  await test('keeps successful ayahs and marks failed responses retryable without false completion', async () => {
    let firstAyahFailure = true;
    const { library, downloader } = create(async input => {
      const url = String(input);
      if (url.endsWith('/1.mp3') && firstAyahFailure) {
        firstAyahFailure = false;
        return makeResponse('text/html');
      }
      return makeResponse();
    });
    try {
      const first = await library.createJob(range, 100);
      const partial = await downloader.download(first.id);
      const items = await library.listJobItems(first.id);
      assert(partial.status === 'partial' && partial.completedAyahs === 2, 'Two valid ayahs should be retained as a partial job');
      assert(items.filter(item => item.status === 'failed').length === 1, 'The failed ayah must remain retryable');
      const retry = await library.createJob(range, 600);
      assert(retry.id !== first.id && retry.completedAyahs === 2, 'Retry should reuse verified files without duplicating them');
      const completed = await downloader.download(retry.id);
      assert(completed.status === 'completed' && completed.completedAyahs === 3, 'Retry should complete the missing ayah');
    } finally { library.close(); }
  });

  await test('pause aborts in-flight requests and resume safely completes the remaining range', async () => {
    let block = true;
    let started = 0;
    let resolveStarted!: () => void;
    const bothStarted = new Promise<void>(resolve => { resolveStarted = resolve; });
    const { library, downloader } = create(async (_input, init) => {
      if (!block) return makeResponse();
      started++;
      if (started === 2) resolveStarted();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    });
    try {
      const job = await library.createJob({ ...range, endAyah: 2 }, 100);
      const running = downloader.download(job.id);
      await bothStarted;
      assert(downloader.pause(job.id), 'Active job should accept pause');
      const paused = await running;
      assert(paused.status === 'queued' && paused.completedAyahs === 0, 'Pause must preserve a resumable non-terminal job');
      block = false;
      const resumed = await downloader.resume(job.id);
      assert(resumed.status === 'completed' && resumed.completedAyahs === 2, 'Resume must finish all missing items');
    } finally { library.close(); }
  });

  await test('cancel is terminal and a cancelled job cannot be resumed', async () => {
    let started = 0;
    let resolveStarted!: () => void;
    const bothStarted = new Promise<void>(resolve => { resolveStarted = resolve; });
    const { library, downloader } = create(async (_input, init) => {
      started++;
      if (started === 2) resolveStarted();
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
      });
    });
    try {
      const job = await library.createJob({ ...range, endAyah: 2 }, 100);
      const running = downloader.download(job.id);
      await bothStarted;
      assert(downloader.cancel(job.id), 'Active job should accept cancellation');
      const cancelled = await running;
      assert(cancelled.status === 'cancelled', 'Cancellation should be recorded as terminal');
      let rejected = false;
      try { await downloader.resume(job.id); } catch { rejected = true; }
      assert(rejected, 'A cancelled job must not resume silently');
    } finally { library.close(); }
  });

  await test('downloads only URLs produced by the approved canonical CDN builder', async () => {
    let networkCalls = 0;
    const { library, downloader } = create(async () => {
      networkCalls++;
      return makeResponse();
    });
    try {
      const plan = buildQuranAudioDownloadPlan(range);
      assert(plan.items.every(item => new URL(item.url).hostname === 'cdn.islamic.network'), 'Every canonical download URL must use the approved CDN host');
      const job = await library.createJob(range, 100);
      const result = await downloader.download(job.id);
      assert(result.status === 'completed' && networkCalls === 3, 'The canonical plan should download every requested ayah');
    } finally { library.close(); }
  });

  return { passed, failed };
}
