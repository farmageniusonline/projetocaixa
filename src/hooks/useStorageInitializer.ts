import { useEffect, useState } from 'react';
import StorageAdapter from '../lib/storageAdapter';

export interface StorageStatus {
  isInitialized: boolean;
  isLoading: boolean;
  usingIndexedDB: boolean;
  error: string | null;
}

export function useStorageInitializer(): StorageStatus {
  const [status, setStatus] = useState<StorageStatus>({
    isInitialized: false,
    isLoading: true,
    usingIndexedDB: false,
    error: null
  });

  useEffect(() => {
    let mounted = true;

    const initializeStorage = async () => {
      try {
        await StorageAdapter.initialize();

        if (mounted) {
          setStatus({
            isInitialized: true,
            isLoading: false,
            usingIndexedDB: StorageAdapter.isUsingIndexedDB(),
            error: null
          });
        }
      } catch (error) {
        console.error('Failed to initialize storage:', error);

        if (mounted) {
          setStatus({
            isInitialized: false,
            isLoading: false,
            usingIndexedDB: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    };

    initializeStorage();

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}

export default useStorageInitializer;