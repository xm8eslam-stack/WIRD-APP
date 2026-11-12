import { getOfflineStorageStatus, requestOfflineStoragePersistence } from './offlineStorageService';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runOfflineStorageServiceTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  const test = async (name: string, run: () => Promise<void>) => {
    try { await run(); passed++; console.log(`  ✅ [PASS]: ${name}`); }
    catch (error) { failed++; console.error(`  ❌ [FAIL]: ${name} - ${error instanceof Error ? error.message : error}`); }
  };

  await test('reports unsupported storage without failing offline setup', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    try {
      const status = await getOfflineStorageStatus();
      assert(!status.supported && status.persisted === null, 'Unsupported storage must be reported explicitly.');
    } finally {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  await test('requests persistent storage and reports current quota', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let requested = false;
    const storage = {
      persist: async () => { requested = true; return true; },
      persisted: async () => true,
      estimate: async () => ({ usage: 1024, quota: 4096 })
    };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage } });
    try {
      const status = await requestOfflineStoragePersistence();
      assert(requested, 'The browser persistence request must be made from the explicit setup action.');
      assert(status.supported && status.persisted === true, 'Persistent storage state must be reported.');
      assert(status.usageBytes === 1024 && status.quotaBytes === 4096, 'Storage usage and quota must be preserved.');
    } finally {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });


  await test('distinguishes available storage from unsupported persistent-storage requests', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const storage = {
      estimate: async () => ({ usage: 2048, quota: 8192 })
    };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage } });
    try {
      const status = await getOfflineStorageStatus();
      assert(status.supported, 'StorageManager availability must be reported independently.');
      assert(!status.persistenceSupported && status.persisted === null, 'Missing persist APIs must not be reported as missing storage.');
      assert(status.usageBytes === 2048 && status.quotaBytes === 8192, 'Quota estimates must remain available without persistent-storage support.');
    } finally {
      if (previous) Object.defineProperty(globalThis, 'navigator', previous);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  return { passed, failed };
}
