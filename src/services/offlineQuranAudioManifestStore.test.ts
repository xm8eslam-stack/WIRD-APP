import 'fake-indexeddb/auto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { buildQuranAyahAudioUrl } from './ruqyahAudioService';
import { OfflineQuranAudioManifestStore } from './offlineQuranAudioManifestStore';

export async function runOfflineQuranAudioManifestStoreTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let index = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ [PASS]: ' + name); }
    catch (error) { failed++; console.error('  ❌ [FAIL]: ' + name + ' - ' + (error instanceof Error ? error.message : error)); }
  };
  const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
  const createStore = () => new OfflineQuranAudioManifestStore({
    indexedDBFactory: new IDBFactory(),
    databaseName: 'wird-offline-audio-manifest-test-' + (++index)
  });

  await test('stores only verified metadata for an exact approved ayah URL', async () => {
    const store = createStore();
    const entry = await store.putVerified({
      reciterId: 'ar.alafasy', surahNumber: 1, ayahNumber: 1, globalAyahNumber: 1,
      url: buildQuranAyahAudioUrl('ar.alafasy', 1), byteLength: 24576,
      savedAtMs: 1700000000000, verified: true
    });
    const records = await store.listVerified();
    assert(entry.key === 'ar.alafasy:1' && entry.schemaVersion === 1, 'The manifest key and schema must be canonical.');
    assert(records.length === 1 && records[0].url === entry.url && records[0].verified,
      'A verified record must round-trip from IndexedDB.');
    await store.close();
  });

  await test('uses idempotent reciter/ayah keys when a verified file is refreshed', async () => {
    const store = createStore();
    const base = {
      reciterId: 'ar.husary', surahNumber: 2, ayahNumber: 2, globalAyahNumber: 9,
      url: buildQuranAyahAudioUrl('ar.husary', 9), verified: true as const
    };
    await store.putVerified({ ...base, byteLength: 30000, savedAtMs: 1700000000000 });
    await store.putVerified({ ...base, byteLength: 31000, savedAtMs: 1700000001000 });
    const records = await store.listVerified();
    assert(records.length === 1 && records[0].byteLength === 31000,
      'Refreshing one reciter/ayah must replace one entry instead of duplicating it.');
    await store.close();
  });

  await test('rejects forged URLs, unsupported reciters, and non-canonical Quran coordinates', async () => {
    const store = createStore();
    const valid = {
      reciterId: 'ar.alafasy', surahNumber: 2, ayahNumber: 2, globalAyahNumber: 9,
      url: buildQuranAyahAudioUrl('ar.alafasy', 9), byteLength: 20000,
      savedAtMs: 1700000000000, verified: true as const
    };
    const invalid = [
      { ...valid, url: 'https://attacker.example/audio.mp3' },
      { ...valid, reciterId: 'unreviewed-reciter' },
      { ...valid, globalAyahNumber: 10 },
      { ...valid, surahNumber: 1 },
      { ...valid, verified: false as unknown as true }
    ];
    for (const input of invalid) {
      let rejected = false;
      try { await store.putVerified(input); } catch { rejected = true; }
      assert(rejected, 'An invalid or unverified manifest entry must fail closed.');
    }
    assert((await store.listVerified()).length === 0, 'Rejected entries must never reach IndexedDB.');
    await store.close();
  });

  await test('rejects empty file sizes and invalid timestamps', async () => {
    const store = createStore();
    const base = {
      reciterId: 'ar.alafasy', surahNumber: 1, ayahNumber: 1, globalAyahNumber: 1,
      url: buildQuranAyahAudioUrl('ar.alafasy', 1), verified: true as const
    };
    for (const input of [
      { ...base, byteLength: 0, savedAtMs: 1700000000000 },
      { ...base, byteLength: -1, savedAtMs: 1700000000000 },
      { ...base, byteLength: 10, savedAtMs: -1 },
      { ...base, byteLength: 10, savedAtMs: Number.NaN }
    ]) {
      let rejected = false;
      try { await store.putVerified(input); } catch { rejected = true; }
      assert(rejected, 'Invalid file metadata must be rejected.');
    }
    await store.close();
  });

  await test('removes one manifest record without touching another reciter', async () => {
    const store = createStore();
    await store.putVerified({
      reciterId: 'ar.alafasy', surahNumber: 1, ayahNumber: 1, globalAyahNumber: 1,
      url: buildQuranAyahAudioUrl('ar.alafasy', 1), byteLength: 10000,
      savedAtMs: 1700000000000, verified: true
    });
    await store.putVerified({
      reciterId: 'ar.husary', surahNumber: 1, ayahNumber: 1, globalAyahNumber: 1,
      url: buildQuranAyahAudioUrl('ar.husary', 1), byteLength: 12000,
      savedAtMs: 1700000000000, verified: true
    });
    await store.removeManifestEntry('ar.alafasy', 1);
    const records = await store.listVerified();
    assert(records.length === 1 && records[0].reciterId === 'ar.husary',
      'Deleting one reciter entry must preserve the other reciter entry for the same ayah.');
    await store.close();
  });

  await test('normalizes quota failures without claiming that a manifest write succeeded', async () => {
    const store = createStore();
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    };
    let message = '';
    try {
      await store.putVerified({
        reciterId: 'ar.alafasy', surahNumber: 1, ayahNumber: 1, globalAyahNumber: 1,
        url: buildQuranAyahAudioUrl('ar.alafasy', 1), byteLength: 10000,
        savedAtMs: 1700000000000, verified: true
      });
    } catch (error) { message = error instanceof Error ? error.message : String(error); }
    finally { IDBObjectStore.prototype.put = originalPut; }
    assert(message.includes('مساحة التخزين المحلية لا تكفي'),
      'QuotaExceededError must produce a clear local storage error.');
    assert((await store.listVerified()).length === 0, 'A rejected write must not appear as a saved manifest record.');
    await store.close();
  });

  await test('committed manifest records survive closing and reopening the database', async () => {
    const factory = new IDBFactory();
    const databaseName = 'wird-offline-audio-manifest-reopen-test';
    const first = new OfflineQuranAudioManifestStore({ indexedDBFactory: factory, databaseName });
    await first.putVerified({
      reciterId: 'ar.alafasy', surahNumber: 114, ayahNumber: 6, globalAyahNumber: 6236,
      url: buildQuranAyahAudioUrl('ar.alafasy', 6236), byteLength: 18000,
      savedAtMs: 1700000000000, verified: true
    });
    await first.close();
    const reopened = new OfflineQuranAudioManifestStore({ indexedDBFactory: factory, databaseName });
    const records = await reopened.listVerified();
    assert(records.length === 1 && records[0].globalAyahNumber === 6236,
      'The final canonical Quran ayah record must survive a database reopen.');
    await reopened.close();
  });

  return { passed, failed };
}
