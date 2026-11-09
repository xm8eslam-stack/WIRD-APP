export interface OfflinePreparationProgress {
  completed: number;
  total: number;
  asset?: string;
}

export interface OfflinePreparationResult {
  completed: number;
  total: number;
}

type OfflineWorkerMessage =
  | { type: 'progress'; completed: number; total: number; asset?: string }
  | { type: 'complete'; completed: number; total: number }
  | { type: 'error'; message: string };

const DEFAULT_OFFLINE_PREPARATION_TIMEOUT_MS = 15 * 60 * 1000;
const SERVICE_WORKER_READY_TIMEOUT_MS = 20 * 1000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), Math.max(1, timeoutMs));
    promise.then(
      value => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

/**
 * Explicitly downloads every same-origin JS/CSS build asset, including lazy
 * routes and bundled data chunks. The service worker persists progress in a
 * dedicated cache, so retrying safely skips assets already stored.
 */
export async function prepareWirdForOffline(
  onProgress?: (progress: OfflinePreparationProgress) => void,
  timeoutMs = DEFAULT_OFFLINE_PREPARATION_TIMEOUT_MS
): Promise<OfflinePreparationResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('هذا المتصفح لا يدعم تجهيز وِرد للعمل دون إنترنت.');
  }

  await withTimeout(
    navigator.serviceWorker.ready,
    Math.min(timeoutMs, SERVICE_WORKER_READY_TIMEOUT_MS),
    'انتهت مهلة انتظار تهيئة التخزين المحلي؛ أعد فتح التطبيق ثم حاول مجددًا.'
  );
  const controller = navigator.serviceWorker.controller;
  if (!controller) {
    throw new Error('افتح وِرد مرة أخرى بعد تثبيت التطبيق، ثم أعد التجهيز المحلي.');
  }

  const channel = new MessageChannel();
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, result?: OfflinePreparationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      channel.port1.close();
      if (error) reject(error);
      else resolve(result!);
    };

    timeoutId = setTimeout(() => {
      finish(new Error('استغرق تجهيز الملفات وقتًا أطول من المتوقع؛ قد تكون الملفات المكتملة محفوظة، ويمكنك إعادة المحاولة للتحقق والاستكمال.'));
    }, Math.max(1, timeoutMs));

    channel.port1.onmessage = (event: MessageEvent<OfflineWorkerMessage>) => {
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'progress') {
        if (!Number.isSafeInteger(message.completed) || !Number.isSafeInteger(message.total) ||
            message.total <= 0 || message.completed < 0 || message.completed > message.total) return;
        try {
          onProgress?.({ completed: message.completed, total: message.total, asset: message.asset });
        } catch {
          finish(new Error('تعذر تحديث مؤشر تقدم التجهيز المحلي.'));
        }
      } else if (message.type === 'complete') {
        if (!Number.isSafeInteger(message.completed) || !Number.isSafeInteger(message.total) ||
            message.total <= 0 || message.completed !== message.total) {
          finish(new Error('وصلت نتيجة غير مكتملة من خدمة التجهيز المحلي.'));
          return;
        }
        finish(undefined, { completed: message.completed, total: message.total });
      } else if (message.type === 'error') {
        finish(new Error(typeof message.message === 'string' && message.message
          ? message.message
          : 'تعذر إكمال التجهيز المحلي.'));
      }
    };

    channel.port1.onmessageerror = () => finish(new Error('تعذر استقبال حالة التجهيز المحلي من المتصفح.'));
    channel.port1.start();

    try {
      controller.postMessage({ type: 'WIRD_PREPARE_OFFLINE_PACKAGE' }, [channel.port2]);
    } catch (error) {
      finish(error instanceof Error ? error : new Error('تعذر بدء التجهيز المحلي.'));
    }
  });
}
