import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';
import {
  OfflineQuranAudioLibrary,
  type OfflineAudioJob
} from './offlineQuranAudioLibrary';
import {
  OfflineQuranAudioCacheAdapter,
  type OfflineAudioCacheIdentity
} from './offlineQuranAudioCache';
import { createSecureId } from './secureId';

interface ActiveDownload {
  controller: AbortController;
  intent: 'pause' | 'cancel' | null;
  promise: Promise<OfflineAudioJob>;
}

export interface OfflineQuranAudioDownloaderOptions {
  fetchImpl?: typeof fetch;
  concurrency?: 1 | 2;
  now?: () => number;
}

function abortError(): Error {
  const error = new Error('تم إيقاف تنزيل التلاوة مؤقتًا.');
  error.name = 'AbortError';
  return error;
}

function validateApprovedAudioUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error('رابط ملف التلاوة غير صالح.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.islamic.network' ||
      url.username || url.password || url.port) {
    throw new Error('مصدر ملف التلاوة ليس ضمن النطاق المعتمد للتنزيل.');
  }
  return url;
}

/**
 * Bounded, device-local downloader. The caller must reconcile Cache Storage
 * before creating jobs; this class never uploads audio or metadata to cloud sync.
 */
export class OfflineQuranAudioDownloader {
  private readonly fetchImpl: typeof fetch;
  private readonly concurrency: 1 | 2;
  private readonly now: () => number;
  private readonly active = new Map<string, ActiveDownload>();

  constructor(
    private readonly library: OfflineQuranAudioLibrary,
    private readonly cache: OfflineQuranAudioCacheAdapter,
    options: OfflineQuranAudioDownloaderOptions = {}
  ) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('تنزيل التلاوات غير مدعوم في هذا المتصفح.');
    this.fetchImpl = fetchImpl;
    this.concurrency = options.concurrency ?? 2;
    if (this.concurrency !== 1 && this.concurrency !== 2) throw new RangeError('عدد طلبات التنزيل المتزامنة يجب أن يكون 1 أو 2.');
    this.now = options.now ?? Date.now;
  }

  download(jobId: string): Promise<OfflineAudioJob> {
    const current = this.active.get(jobId);
    if (current) return current.promise;
    const execution: ActiveDownload = {
      controller: new AbortController(),
      intent: null,
      promise: Promise.resolve(null as unknown as OfflineAudioJob)
    };
    execution.promise = this.run(jobId, execution).finally(() => {
      if (this.active.get(jobId) === execution) this.active.delete(jobId);
    });
    this.active.set(jobId, execution);
    return execution.promise;
  }

  resume(jobId: string): Promise<OfflineAudioJob> {
    return this.download(jobId);
  }

  pause(jobId: string): boolean {
    const active = this.active.get(jobId);
    if (!active) return false;
    active.intent = 'pause';
    active.controller.abort();
    return true;
  }

  cancel(jobId: string): boolean {
    const active = this.active.get(jobId);
    if (!active) return false;
    active.intent = 'cancel';
    active.controller.abort();
    return true;
  }

  getActiveJobIds(): string[] {
    return [...this.active.keys()];
  }

  private async run(jobId: string, execution: ActiveDownload): Promise<OfflineAudioJob> {
    const job = await this.library.getJob(jobId);
    if (!job) throw new Error('مهمة تنزيل التلاوة غير موجودة.');
    if (job.status === 'completed') return job;
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error('هذه المهمة منتهية؛ أنشئ محاولة جديدة لإعادة تنزيل الآيات غير المتاحة.');
    }

    const plan = buildQuranAudioDownloadPlan(job);
    const relations = await this.library.listJobItems(jobId);
    const pending = relations.filter(item => item.status !== 'verified');
    if (pending.length === 0) return (await this.library.getJob(jobId))!;

    if (job.status !== 'downloading') await this.library.setJobStatus(jobId, 'downloading', this.now());
    let nextIndex = 0;
    let failures = 0;

    const worker = async () => {
      while (!execution.controller.signal.aborted) {
        const item = pending[nextIndex++];
        if (!item) return;
        const planned = plan.items.find(candidate => candidate.globalAyahNumber === item.globalAyahNumber);
        if (!planned) {
          failures++;
          await this.library.markItemFailed(jobId, item.globalAyahNumber, this.now()).catch(() => undefined);
          continue;
        }

        try {
          await this.library.markItemDownloading(jobId, item.globalAyahNumber, this.now());
          if (execution.controller.signal.aborted) throw abortError();
          const url = validateApprovedAudioUrl(planned.url);
          const response = await this.fetchImpl(url.toString(), {
            method: 'GET',
            signal: execution.controller.signal,
            redirect: 'error',
            credentials: 'omit',
            cache: 'no-store'
          });
          if (execution.controller.signal.aborted) throw abortError();
          if (response.redirected || (response.url && new URL(response.url).href !== url.href)) {
            throw new Error('تم رفض إعادة توجيه ملف التلاوة إلى مصدر آخر.');
          }

          const identity: OfflineAudioCacheIdentity = {
            reciterId: job.reciterId,
            globalAyahNumber: item.globalAyahNumber,
            cacheGenerationId: createSecureId()
          };
          const byteLength = await this.cache.storeVerifiedResponse(identity, response);
          try {
            await this.library.recordVerifiedFile(jobId, {
              reciterId: job.reciterId,
              surahNumber: item.surahNumber,
              ayahNumber: item.ayahNumber,
              globalAyahNumber: item.globalAyahNumber,
              cacheGenerationId: identity.cacheGenerationId,
              url: planned.url,
              byteLength,
              downloadedAtMs: Math.max(this.now(), job.createdAtMs),
              verified: true
            });
          } catch (error) {
            await this.cache.deleteGeneration(identity).catch(() => false);
            throw error;
          }
        } catch (error) {
          if (!execution.controller.signal.aborted) failures++;
          await this.library.markItemFailed(jobId, item.globalAyahNumber, this.now()).catch(() => undefined);
          if (execution.controller.signal.aborted) return;
        }
      }
    };

    await Promise.all(Array.from({ length: this.concurrency }, () => worker()));
    const latest = await this.library.getJob(jobId);
    if (!latest) throw new Error('اختفت مهمة التنزيل أثناء التنفيذ.');
    if (latest.status === 'completed') return latest;

    let finalStatus: OfflineAudioJob['status'];
    if (execution.intent === 'cancel') finalStatus = 'cancelled';
    else if (execution.intent === 'pause') finalStatus = latest.completedAyahs > 0 ? 'partial' : 'queued';
    else if (failures > 0) finalStatus = latest.completedAyahs > 0 ? 'partial' : 'failed';
    else if (latest.completedAyahs === latest.totalAyahs) finalStatus = 'completed';
    else finalStatus = latest.completedAyahs > 0 ? 'partial' : 'queued';

    const updated = await this.library.setJobStatus(jobId, finalStatus, this.now());
    return updated;
  }
}
