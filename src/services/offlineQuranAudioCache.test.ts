import {
  OfflineQuranAudioCacheAdapter,
  buildOfflineAudioCacheKey
} from './offlineQuranAudioCache';
import type { OfflineAudioCacheIdentity } from './offlineQuranAudioCache';

class MemoryCache {
  private entries = new Map<string, Response>();
  async match(request: Request): Promise<Response | undefined> {
    const value = this.entries.get(request.url);
    return value?.clone();
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
  async open(_name: string): Promise<Cache> {
    return this.cache as unknown as Cache;
  }
}

const identity: OfflineAudioCacheIdentity = {
  reciterId: 'ar.alafasy',
  globalAyahNumber: 1,
  cacheGenerationId: 'generation-a'
};

export async function runOfflineQuranAudioCacheTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ ' + name); }
    catch (error) { failed++; console.error('  ❌ ' + name, error); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const makeResponse = (bytes: number[] = [1, 2, 3, 4], contentType = 'audio/mpeg') =>
    new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': contentType } });

  await test('Cache keys isolate reciters, ayahs, and immutable generations', async () => {
    const a = buildOfflineAudioCacheKey(identity, 'https://wird.test');
    const b = buildOfflineAudioCacheKey({ ...identity, cacheGenerationId: 'generation-b' }, 'https://wird.test');
    const c = buildOfflineAudioCacheKey({ ...identity, globalAyahNumber: 2 }, 'https://wird.test');
    assert(a.url !== b.url && a.url !== c.url, 'Different cache generations and ayahs must never share a key');
  });

  await test('Stores only a complete audio response and verifies exact cache read-back', async () => {
    const storage = new MemoryCacheStorage();
    const adapter = new OfflineQuranAudioCacheAdapter({ cacheStorage: storage as unknown as CacheStorage, origin: 'https://wird.test' });
    const bytes = await adapter.storeVerifiedResponse(identity, makeResponse([9, 8, 7]));
    assert(bytes === 3, 'Stored byte length should match the response');
    assert(await adapter.hasVerifiedFile(identity), 'Verified cache entry should be available');
    assert(!(await adapter.hasVerifiedFile({ ...identity, byteLength: 99 })), 'Metadata byte-length mismatch must be reported as missing');
    const cached = await adapter.getVerifiedResponse(identity);
    assert(Boolean(cached) && (await cached!.arrayBuffer()).byteLength === 3, 'Cached response should be readable for playback');
  });

  await test('Rejects HTTP errors, HTML, empty bodies, oversized bodies and length mismatches', async () => {
    const storage = new MemoryCacheStorage();
    const adapter = new OfflineQuranAudioCacheAdapter({ cacheStorage: storage as unknown as CacheStorage, origin: 'https://wird.test', maxFileBytes: 3 });
    const invalid: Response[] = [
      new Response('error', { status: 500, headers: { 'content-type': 'audio/mpeg' } }),
      makeResponse([1, 2], 'text/html'),
      makeResponse([], 'audio/mpeg'),
      makeResponse([1, 2, 3, 4], 'audio/mpeg'),
      new Response(new Uint8Array([1, 2]), { status: 200, headers: { 'content-type': 'audio/mpeg', 'content-length': '9' } })
    ];
    for (const response of invalid) {
      let rejected = false;
      try { await adapter.storeVerifiedResponse(identity, response); } catch { rejected = true; }
      assert(rejected, 'Invalid response must not be accepted');
    }
    assert(!(await adapter.hasVerifiedFile(identity)), 'Rejected responses must not remain cached');
  });

  await test('Deleting an old generation never deletes a newer generation', async () => {
    const storage = new MemoryCacheStorage();
    const adapter = new OfflineQuranAudioCacheAdapter({ cacheStorage: storage as unknown as CacheStorage, origin: 'https://wird.test' });
    const newer = { ...identity, cacheGenerationId: 'generation-b' };
    await adapter.storeVerifiedResponse(identity, makeResponse([1]));
    await adapter.storeVerifiedResponse(newer, makeResponse([2]));
    assert(await adapter.deleteGeneration(identity), 'Old generation should be deleted');
    assert(!(await adapter.hasVerifiedFile(identity)), 'Old generation should be absent');
    assert(await adapter.hasVerifiedFile(newer), 'New generation must remain available');
  });

  await test('Rejects unsafe cache origins and malformed identities', async () => {
    let badOrigin = false;
    let badIdentity = false;
    try { buildOfflineAudioCacheKey(identity, 'http://remote.example'); } catch { badOrigin = true; }
    try { buildOfflineAudioCacheKey({ ...identity, globalAyahNumber: 6237 }, 'https://wird.test'); } catch { badIdentity = true; }
    assert(badOrigin && badIdentity, 'Unsafe origin and Quran coordinates must fail closed');
  });

  return { passed, failed };
}
