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
      cacheGenerationId: 'generation-1',
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
      const second = await library.createJob({ reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 2 }, 200);
      await library.recordVerifiedFile(first.id, verifiedInput());
      const secondAfterSharedFile = await library.getJob(second.id);
      const secondItems = await library.listJobItems(second.id);
      assert(secondAfterSharedFile?.completedAyahs === 1 && secondAfterSharedFile.status === 'partial', 'A file completed in another job must advance every live referencing job.');
      assert(secondItems[0].status === 'verified', 'The shared job-item relation must become verified when the canonical file is committed.');
      const firstDelete = await library.deleteJob(first.id);
      assert(firstDelete.orphanedFiles.length === 0 && (await library.listFiles()).length === 1, 'Deleting one job must preserve a file referenced by another job.');
      const secondDelete = await library.deleteJob(second.id);
      assert(secondDelete.orphanedFiles.length === 1 && secondDelete.orphanedFiles[0].key === 'ar.alafasy:1', 'The last relation removal must return the now-orphaned file for Cache Storage cleanup.');
      assert((await library.listFiles())[0].deletionPending, 'The orphan record must remain durable until Cache Storage deletion is confirmed.');
      assert(await library.finalizeOrphanDeletion('ar.alafasy', 1), 'Successful Cache Storage deletion must finalize metadata removal.');
      assert((await library.listFiles()).length === 0, 'Finalized orphan metadata must be removed.');
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
      assert(unpin.orphanedFiles.length === 1 && (await library.listFiles())[0].deletionPending, 'Explicit unpin with no job references must create a durable deletion candidate.');
      assert(await library.finalizeOrphanDeletion('ar.alafasy', 1), 'The caller may finalize after Cache Storage deletion succeeds.');
      assert((await library.listFiles()).length === 0, 'The file metadata must disappear only after deletion is finalized.');
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
        await library.recordVerifiedFile(job.id, { ...verifiedInput(), cacheGenerationId: 'generation-2', downloadedAtMs: 400 });
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

  await test('aborts the complete job transaction when an IndexedDB write hits quota', async () => {
    const factory = new IDBFactory();
    const databaseName = 'wird-offline-audio-library-quota-test';
    const library = new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName });
    const originalAdd = IDBObjectStore.prototype.add;
    let message = '';
    IDBObjectStore.prototype.add = function (value: any, key?: IDBValidKey) {
      if (this.name === 'jobItems') throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      return originalAdd.call(this, value, key);
    };
    try {
      try { await library.createJob({ reciterId: 'ar.alafasy', surahNumber: 1, startAyah: 1, endAyah: 2 }, 100); }
      catch (error) { message = error instanceof Error ? error.message : String(error); }
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
      library.close();
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    const reopened = new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName });
    try {
      assert(message.includes('مساحة التخزين المحلية ممتلئة'), 'Quota errors must be normalized for the user.');
      assert((await reopened.listJobs()).length === 0, 'A failed job-item write must roll back the job record too.');
    } finally { reopened.close(); }
  });

  await test('a new job safely cancels a pending orphan deletion after re-downloading the same ayah', async () => {
    const { library } = createLibrary();
    try {
      const first = await library.createJob(oneAyah, 100);
      await library.recordVerifiedFile(first.id, verifiedInput());
      const orphan = await library.deleteJob(first.id);
      assert(orphan.orphanedFiles.length === 1, 'Deleting the last job should schedule orphan cleanup.');
      const second = await library.createJob(oneAyah, 300);
      assert(second.status === 'queued', 'A file scheduled for deletion must not be reused as available.');
      await library.recordVerifiedFile(second.id, { ...verifiedInput(), downloadedAtMs: 400 });
      const replacement = (await library.listFiles())[0];
      assert(replacement.available && !replacement.deletionPending && replacement.cacheGenerationId === 'generation-2', 'A new verified download must install a fresh cache generation and cancel the stale deletion marker.');
      assert(!(await library.finalizeOrphanDeletion('ar.alafasy', 1)), 'A stale cleanup attempt must not delete a newly downloaded file.');
      assert((await library.listFiles()).length === 1, 'The newly downloaded canonical file must remain.');
    } finally { library.close(); }
  });

  await test('rejects invalid timestamps without corrupting job metadata', async () => {
    const { library } = createLibrary();
    try {
      const job = await library.createJob(oneAyah, 100);
      let statusRejected = false;
      try { await library.setJobStatus(job.id, 'downloading', Number.NaN); }
      catch { statusRejected = true; }
      let itemRejected = false;
      try { await library.markItemDownloading(job.id, 1, Number.POSITIVE_INFINITY); }
      catch { itemRejected = true; }
      const unchanged = await library.getJob(job.id);
      assert(statusRejected && itemRejected, 'Non-finite timestamps must be rejected before writing.');
      assert(unchanged?.status === 'queued' && unchanged.updatedAtMs === 100, 'Rejected timestamps must leave the stored job unchanged and valid.');
    } finally { library.close(); }
  });

  return { passed, failed };
}
