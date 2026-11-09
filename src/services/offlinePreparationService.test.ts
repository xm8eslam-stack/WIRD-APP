import { prepareWirdForOffline, type OfflinePreparationProgress } from './offlinePreparationService';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function installNavigator(serviceWorker?: unknown): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    enumerable: previous?.enumerable ?? true,
    writable: true,
    value: serviceWorker === undefined ? {} : { serviceWorker }
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else Reflect.deleteProperty(globalThis, 'navigator');
  };
}

function createServiceWorkerContainer(
  onPostMessage: (port: MessagePort) => void,
  ready: Promise<unknown> = Promise.resolve({})
): ServiceWorkerContainer {
  const controller = {
    postMessage: (_message: unknown, ports: Transferable[]) => onPostMessage(ports[0] as MessagePort)
  } as unknown as ServiceWorker;
  return { ready: ready as Promise<ServiceWorkerRegistration>, controller } as unknown as ServiceWorkerContainer;
}

async function expectError(promise: Promise<unknown>, expected: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expected), `Expected error containing "${expected}".`);
    return;
  }
  throw new Error(`Expected rejection containing "${expected}".`);
}

export async function runOfflinePreparationServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  const test = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
      passed++;
      console.log(`  ✅ [PASS]: ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ❌ [FAIL]: ${name} - ${error instanceof Error ? error.message : error}`);
    }
  };

  await test('reports progress and resolves only after a complete worker response', async () => {
    let remotePort: MessagePort | undefined;
    const restore = installNavigator(createServiceWorkerContainer(port => {
      remotePort = port;
      queueMicrotask(() => {
        port.postMessage({ type: 'progress', completed: 1, total: 2, asset: '/assets/one.js' });
        port.postMessage({ type: 'complete', completed: 2, total: 2 });
      });
    }));
    try {
      const progress: OfflinePreparationProgress[] = [];
      const result = await prepareWirdForOffline(value => progress.push(value), 1000);
      assert(result.completed === 2 && result.total === 2, 'The completed result must preserve the worker totals.');
      assert(progress.length === 1 && progress[0].completed === 1, 'Progress must be forwarded to the caller.');
    } finally {
      remotePort?.close();
      restore();
    }
  });

  await test('surfaces worker errors without reporting success', async () => {
    let remotePort: MessagePort | undefined;
    const restore = installNavigator(createServiceWorkerContainer(port => {
      remotePort = port;
      queueMicrotask(() => port.postMessage({ type: 'error', message: 'offline test failure' }));
    }));
    try {
      await expectError(prepareWirdForOffline(undefined, 1000), 'offline test failure');
    } finally {
      remotePort?.close();
      restore();
    }
  });

  await test('times out if the worker stops responding', async () => {
    let remotePort: MessagePort | undefined;
    const restore = installNavigator(createServiceWorkerContainer(port => {
      remotePort = port;
    }));
    try {
      await expectError(prepareWirdForOffline(undefined, 5), 'استغرق تجهيز الملفات وقتًا أطول');
    } finally {
      remotePort?.close();
      restore();
    }
  });

  await test('times out while waiting for service-worker readiness', async () => {
    const neverReady = new Promise<unknown>(() => {});
    const restore = installNavigator({ ready: neverReady, controller: null });
    try {
      await expectError(prepareWirdForOffline(undefined, 5), 'انتهت مهلة انتظار تهيئة التخزين المحلي');
    } finally {
      restore();
    }
  });

  await test('rejects unsupported browsers and pages not yet controlled by the worker', async () => {
    const restoreUnsupported = installNavigator({});
    try {
      await expectError(prepareWirdForOffline(undefined, 1000), 'لا يدعم تجهيز وِرد');
    } finally {
      restoreUnsupported();
    }

    const restoreUncontrolled = installNavigator({
      ready: Promise.resolve({}),
      controller: null
    });
    try {
      await expectError(prepareWirdForOffline(undefined, 1000), 'افتح وِرد مرة أخرى');
    } finally {
      restoreUncontrolled();
    }
  });

  return { passed, failed };
}
