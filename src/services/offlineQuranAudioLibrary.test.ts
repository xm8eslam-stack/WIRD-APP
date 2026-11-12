import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';
import { OfflineQuranAudioLibrary } from './offlineQuranAudioLibrary';

export async function runOfflineQuranAudioLibraryTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let index = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log('  ✅ [PASS]: ' + name); }
    catch (error) { failed++; console.error('  ❌ [FAIL]: ' + name + ' - ' + (error instanceof Error ? error.message : error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const createLibrary = (factory = new IDBFactory()) => {
    const databaseName = 'wird-offline-audio-library-test-' + (++index);
    return { factory, databaseName, library: new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName }) };
  };
  const oneAyah = { reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 1 };
  const verifiedInput = () => {
    const item = buildQuranAudioDownloadPlan(oneAyah).items[0];
    return {
      reciterId: oneAyah.reciterId,
      ...item,
      byteLength: 2048,
      downloadedAtMs: 200,
      verified: true as const
    };
  };

  await test('creates a bounded job with canonical job-to-file relations and reuses duplicate active requests', async () => {
    const { library } = createLibrary();
    try {
      const range = { reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 3 };
      const first = await library.createJob(range, 100);
      const duplicate = await library.createJob(range, 101);
      const items = await library.listJobItems(first.id);
      assert(first.status === 'queued' && first.totalAyahs === 3 && first.completedAyahs === 0, 'A new job must start queued with the exact canonical count.');
      assert(duplicate.id === first.id, 'A duplicate active request must reuse its existing job.');
      assert(items.length === 3 && items.every(item => item.status === 'queued'), 'Each requested ayah must have one queued relation.');
    } finally { library.close(); }
  });

  await test('records a verified file idempotently and advances progress exactly once', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob(oneAyah, 100);
      const file = verifiedInput();
      const first = await library.recordVerifiedFile(job.id, file);
      const duplicate = await library.recordVerifiedFile(job.id, file);
      const files = await library.listFiles();
      const items = await library.listJobItems(job.id);
      assert(first.status === 'completed' && first.completedAyahs === 1, 'The only ayah must complete the job.');
      assert(duplicate.completedAyahs === 1 && files.length === 1, 'A repeated completion must not duplicate bytes metadata or progress.');
      assert(items[0].status === 'verified' && files[0].available, 'The relation and canonical file must both be verified and available.');
    } finally { library.close(); }
  });

  await test('shares one canonical file across overlapping jobs and deletes it only after the final reference is removed', async () => {
    const { library } = createLibrary();
    try {
      const first = await library.createJob(oneAyah, 100);
      await library.recordVerifiedFile(first.id, verifiedInput());
      const second = await library.createJob({ reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 2 }, 300);
      assert(second.completedAyahs === 1 && second.status === 'partial', 'The second job must reuse the already verified first ayah.');
      const firstDelete = await library.deleteJob(first.id);
      assert(firstDelete.orphanedFiles.length === 0 && (await library.listFiles()).length === 1, 'Deleting one job must preserve a file referenced by another job.');
      const secondDelete = await library.deleteJob(second.id);
      assert(secondDelete.orphanedFiles.length === 1 && secondDelete.orphanedFiles[0].key === 'ar.alafasy:1', 'The last relation removal must return the now-orphaned file for Cache Storage cleanup.');
      assert((await library.listFiles()).length === 0, 'Unpinned orphan metadata must be removed.');
    } finally { library.close(); }
  });

  await test('preserves pinned audio after job deletion and returns it only after explicit unpin', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob(oneAyah, 100);
      await library.recordVerifiedFile(job.id, verifiedInput());
      await library.setFilePinned('ar.alafasy', 1, true);
      const deletion = await library.deleteJob(job.id);
      assert(deletion.orphanedFiles.length === 0 && (await library.listFiles())[0].pinned, 'Deleting the job must preserve a pinned file.');
      const unpin = await library.setFilePinned('ar.alafasy', 1, false);
      assert(unpin.orphanedFiles.length === 1 && (await library.listFiles()).length === 0, 'Explicit unpin with no job references must return the file for deletion.');
    } finally { library.close(); }
  });

  await test('rejects forged URLs and coordinates without recording progress', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob(oneAyah, 100);
      let rejected = false;
      try { await library.recordVerifiedFile(job.id, { ...verifiedInput(), url: 'https://attacker.example/audio.mp3' }); }
      catch { rejected = true; }
      assert(rejected, 'A URL outside the approved canonical builder must be rejected.');
      assert((await library.getJob(job.id))?.completedAyahs === 0 && (await library.listFiles()).length === 0, 'Rejected content must not alter progress or file metadata.');
    } finally { library.close(); }
  });

  await test('does not allow a cancelled job to accept new verified files', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob(oneAyah, 100);
      await library.setJobStatus(job.id, 'cancelled', 110);
      let rejected = false;
      try { await library.recordVerifiedFile(job.id, verifiedInput()); } catch { rejected = true; }
      assert(rejected, 'Cancelled jobs must reject new file relations.');
      assert((await library.getJob(job.id))?.status === 'cancelled' && (await library.listFiles()).length === 0, 'Cancellation must remain terminal and preserve no false completion.');
    } finally { library.close(); }
  });

  await test('reconciles browser-evicted files without losing pin metadata and allows a safe redownload job', async () => {
    const { library } = createLibrary();
    try {
      const first = await library.createJob(oneAyah, 100);
      await library.recordVerifiedFile(first.id, verifiedInput());
      await library.setFilePinned('ar.alafasy', 1, true);
      const missing = await library.reconcileCachedFiles(async () => false);
      const file = (await library.listFiles())[0];
      assert(missing.length === 1 && file.available === false && file.pinned, 'Cache eviction must mark the file missing while preserving its pin choice.');
      const retry = await library.createJob(oneAyah, 300);
      assert(retry.id !== first.id && retry.status === 'queued' && retry.completedAyahs === 0, 'A missing cache object must not be treated as a completed offline file.');
    } finally { library.close(); }
  });

  await test('does not mark a newer concurrent download missing after a slow cache scan', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob(oneAyah, 100);
      await library.recordVerifiedFile(job.id, verifiedInput());
      const missing = await library.reconcileCachedFiles(async () => {
        await library.recordVerifiedFile(job.id, { ...verifiedInput(), downloadedAtMs: 400 });
        return false;
      });
      assert(missing.length === 1, 'The stale scan may report its earlier observation.');
      assert((await library.listFiles())[0].available, 'A newer download must remain available after a stale cache scan.');
    } finally { library.close(); }
  });

  await test('refuses to mark an incomplete job completed', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob({ reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 2 }, 100);
      let rejected = false;
      try { await library.setJobStatus(job.id, 'completed', 110); } catch { rejected = true; }
      assert(rejected && (await library.getJob(job.id))?.status === 'queued', 'A job cannot claim completion while ayahs are missing.');
    } finally { library.close(); }
  });

  await test('persists jobs and canonical files across database close and reopen', async () => {
    const factory = new IDBFactory();
    const databaseName = 'wird-offline-audio-library-reopen-test';
    const first = new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName });
    const job = await first.createJob(oneAyah, 100);
    await first.recordVerifiedFile(job.id, verifiedInput());
    first.close();
    const reopened = new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName });
    try {
      assert((await reopened.getJob(job.id))?.status === 'completed', 'The job must survive a database reopen.');
      assert((await reopened.listFiles()).length === 1, 'The canonical verified file must survive a database reopen.');
    } finally { reopened.close(); }
  });

  return { passed, failed };
}
