export interface OfflineStorageStatus {
  supported: boolean;
  persistenceSupported: boolean;
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

function getStorageManager(): StorageManager | null {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) return null;
  return navigator.storage;
}

export async function getOfflineStorageStatus(): Promise<OfflineStorageStatus> {
  const storage = getStorageManager();
  if (!storage) return { supported: false, persistenceSupported: false, persisted: null, usageBytes: null, quotaBytes: null };

  const [persisted, estimate] = await Promise.all([
    typeof storage.persisted === 'function'
      ? storage.persisted().catch(() => false)
      : Promise.resolve(false),
    typeof storage.estimate === 'function'
      ? storage.estimate().catch(() => ({} as StorageEstimate))
      : Promise.resolve({} as StorageEstimate)
  ]);

  return {
    supported: true,
    persistenceSupported: typeof storage.persist === 'function',
    persisted: typeof storage.persisted === 'function' ? persisted : null,
    usageBytes: Number.isFinite(estimate.usage) ? estimate.usage! : null,
    quotaBytes: Number.isFinite(estimate.quota) ? estimate.quota! : null
  };
}

/** Request browser storage persistence only after the user explicitly starts offline setup. */
export async function requestOfflineStoragePersistence(): Promise<OfflineStorageStatus> {
  const storage = getStorageManager();
  if (!storage) return getOfflineStorageStatus();
  if (typeof storage.persist === 'function') {
    try { await storage.persist(); } catch { /* Continue with ordinary browser-managed storage. */ }
  }
  return getOfflineStorageStatus();
}
