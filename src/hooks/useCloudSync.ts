import { useEffect, useState } from 'react';
import { cloudSyncCoordinator, CloudSyncState } from '../services/cloudSyncCoordinator';

export function useCloudSync(): CloudSyncState & { triggerSync: () => Promise<boolean> } {
  const [syncState, setSyncState] = useState<CloudSyncState>(cloudSyncCoordinator.getState());

  useEffect(() => {
    const unsubscribe = cloudSyncCoordinator.subscribe(setSyncState);
    cloudSyncCoordinator.startPeriodicSync();
    void cloudSyncCoordinator.refreshPendingCount();

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...syncState,
    triggerSync: () => cloudSyncCoordinator.triggerSync()
  };
}
