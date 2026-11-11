import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';
import { OfflineQuranAudioDownloadStore } from './offlineQuranAudioDownloadStore';

export async function runOfflineQuranAudioDownloadStoreTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let index = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ [PASS]: ' + name); }
    catch (error) { failed++; console.error('  ❌ [FAIL]: ' + name + ' - ' + (error instanceof Error ? error.message : error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const createStore = () => {
    index++;
    const factory = new IDBFactory();
    const databaseName = 'wird-offline-audio-store-test-' + index;
    return { factory, databaseName, store: new OfflineQuranAudioDownloadStore({ indexedDBFactory: factory, databaseName }) };
  };
  const request = { reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 2 };

  await test('creates a device-local queued job from an approved Quran range', async () => {
    const { store } = createStore();
    try {
      const job = await store.createJob(request, 100);
      assert(job.schemaVersion === 1 && job.status === 'queued', 'New jobs must use the current schema and queued state.');
      assert(job.totalAyahs === 2 && job.completedAyahs === 0, 'The job must preserve the exact planned ayah count.');
      assert((await store.getJob(job.id))?.id === job.id, 'The job must be readable from local IndexedDB.');
    } finally { store.close(); }
  });

  await test('records verified ayahs atomically and treats duplicate completion as idempotent', async () => {
    const { store } = createStore();
    try {
      const job = await store.createJob(request, 100);
      const plan = buildQuranAudioDownloadPlan(request);
      const first = { ...plan.items[0], reciterId: request.reciterId, byteLength: 4096, downloadedAtMs: 110, verified: true as const };
      const second = { ...plan.items[1], reciterId: request.reciterId, byteLength: 2048, downloadedAtMs: 120, verified: true as const };
      const partial = await store.recordDownloadedAyah(job.id, first, 111);
      assert(partial.completedAyahs === 1 && partial.status === 'partial', 'The first verified file must advance the job exactly once.');
      const duplicate = await store.recordDownloadedAyah(job.id, first, 112);
      assert(duplicate.completedAyahs === 1, 'Re-recording the same verified file must not double-count it.');
      const completed = await store.recordDownloadedAyah(job.id, second, 121);
      assert(completed.completedAyahs === 2 && completed.status === 'completed', 'The final file must complete the range.');
      assert((await store.listItems(job.id)).length === 2, 'The manifest must contain exactly two unique ayah records.');
    } finally { store.close(); }
  });

  await test('rejects a mismatched URL or coordinate without changing the manifest', async () => {
    const { store } = createStore();
    try {
      const job = await store.createJob(request, 100);
      const plan = buildQuranAudioDownloadPlan(request);
      let rejected = false;
      try {
        await store.recordDownloadedAyah(job.id, {
          ...plan.items[0], reciterId: request.reciterId,
          url: 'https://untrusted.example/audio.mp3', byteLength: 10, downloadedAtMs: 110, verified: true
        }, 111);
      } catch { rejected = true; }
      assert(rejected, 'A file URL outside the exact approved plan must be rejected.');
      assert((await store.getJob(job.id))?.completedAyahs === 0, 'Rejected files must not advance job progress.');
      assert((await store.listItems(job.id)).length === 0, 'Rejected files must not enter the manifest.');
    } finally { store.close(); }
  });

  await test('supports explicit status changes and refuses writes after cancellation', async () => {
    const { store } = createStore();
    try {
      const job = await store.createJob(request, 100);
      const downloading = await store.setJobStatus(job.id, 'downloading', 105);
      assert(downloading.status === 'downloading', 'A queued job may transition to downloading.');
      const cancelled = await store.setJobStatus(job.id, 'cancelled', 110);
      assert(cancelled.status === 'cancelled', 'The user may cancel an unfinished job.');
      const plan = buildQuranAudioDownloadPlan(request);
      let rejected = false;
      try {
        await store.recordDownloadedAyah(job.id, {
          ...plan.items[0], reciterId: request.reciterId, byteLength: 10, downloadedAtMs: 111, verified: true
        }, 112);
      } catch { rejected = true; }
      assert(rejected, 'A cancelled job must not accept a newly downloaded file.');
      assert((await store.getJob(job.id))?.completedAyahs === 0, 'Cancellation must preserve the prior completed count.');
    } finally { store.close(); }
  });

  await test('persists job and ayah metadata after closing and reopening IndexedDB', async () => {
    const { factory, databaseName, store } = createStore();
    const job = await store.createJob(request, 100);
    const plan = buildQuranAudioDownloadPlan(request);
    await store.recordDownloadedAyah(job.id, {
      ...plan.items[0], reciterId: request.reciterId, byteLength: 1000, downloadedAtMs: 110, verified: true
    }, 111);
    store.close();
    const reopened = new OfflineQuranAudioDownloadStore({ indexedDBFactory: factory, databaseName });
    try {
      assert((await reopened.getJob(job.id))?.completedAyahs === 1, 'Job progress must survive a database reopen.');
      assert((await reopened.listItems(job.id))[0]?.globalAyahNumber === 1, 'Verified ayah metadata must survive a database reopen.');
    } finally { reopened.close(); }
  });

  await test('deletes a job and its manifest entries in one transaction', async () => {
    const { store } = createStore();
    try {
      const job = await store.createJob(request, 100);
      const plan = buildQuranAudioDownloadPlan(request);
      await store.recordDownloadedAyah(job.id, {
        ...plan.items[0], reciterId: request.reciterId, byteLength: 1000, downloadedAtMs: 110, verified: true
      }, 111);
      await store.deleteJob(job.id);
      assert(await store.getJob(job.id) === null, 'Deleted jobs must no longer appear.');
      assert((await store.listItems(job.id)).length === 0, 'Deleting a job must remove its metadata entries.');
    } finally { store.close(); }
  });

  return { passed, failed };
}
