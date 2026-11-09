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

/**
 * Explicitly downloads every same-origin JS/CSS build asset, including lazy
 * routes and bundled data chunks. The service worker persists progress in a
 * dedicated cache, so retrying safely skips assets already stored.
 */
export async function prepareWirdForOffline(
  onProgress?: (progress: OfflinePreparationProgress) => void
): Promise<OfflinePreparationResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('هذا المتصفح لا يدعم تجهيز وِرد للعمل دون إنترنت.');
  }

  await navigator.serviceWorker.ready;
  const controller = navigator.serviceWorker.controller;
  if (!controller) {
    throw new Error('افتح وِرد مرة أخرى بعد تثبيت التطبيق، ثم أعد التجهيز المحلي.');
  }

  const channel = new MessageChannel();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, result?: OfflinePreparationResult) => {
      if (settled) return;
      settled = true;
      channel.port1.close();
      if (error) reject(error);
      else resolve(result!);
    };

    channel.port1.onmessage = (event: MessageEvent<OfflineWorkerMessage>) => {
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'progress') {
        onProgress?.({ completed: message.completed, total: message.total, asset: message.asset });
      } else if (message.type === 'complete') {
        finish(undefined, { completed: message.completed, total: message.total });
      } else if (message.type === 'error') {
        finish(new Error(message.message));
      }
    };

    try {
      controller.postMessage({ type: 'WIRD_PREPARE_OFFLINE_PACKAGE' }, [channel.port2]);
    } catch (error) {
      finish(error instanceof Error ? error : new Error('تعذر بدء التجهيز المحلي.'));
    }
  });
}
