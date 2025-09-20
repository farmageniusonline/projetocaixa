import { supabaseDataService } from './supabaseDataService';
import IndexedDbService from './indexedDbService';
import { authService } from './authService';

interface SyncStatus {
  lastSync: Date | null;
  pendingChanges: number;
  isOnline: boolean;
  isSyncing: boolean;
}

interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
}

class SyncService {
  private syncStatus: SyncStatus = {
    lastSync: null,
    pendingChanges: 0,
    isOnline: navigator.onLine,
    isSyncing: false
  };

  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;
  private indexedDbService = new IndexedDbService();

  constructor() {
    this.initializeSync();
  }

  private initializeSync() {
    // Monitor online/offline status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Check for pending changes periodically
    this.startPeriodicSync();

    // Load last sync time from localStorage
    const lastSyncStr = localStorage.getItem('lastSyncTime');
    if (lastSyncStr) {
      this.syncStatus.lastSync = new Date(lastSyncStr);
    }
  }

  private handleOnline() {
    console.log('App is online');
    this.syncStatus.isOnline = true;
    this.notifyListeners();

    // Trigger sync when coming online
    this.syncData();
  }

  private handleOffline() {
    console.log('App is offline');
    this.syncStatus.isOnline = false;
    this.notifyListeners();
  }

  private startPeriodicSync() {
    // Sync every 30 seconds if online
    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.syncData();
      }
    }, 30000);
  }

  private stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async syncData(): Promise<SyncResult> {
    if (!this.syncStatus.isOnline) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        errors: ['App is offline']
      };
    }

    if (!authService.isAuthenticated()) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        errors: ['User not authenticated']
      };
    }

    if (this.syncStatus.isSyncing) {
      return {
        success: false,
        uploaded: 0,
        downloaded: 0,
        errors: ['Sync already in progress']
      };
    }

    this.syncStatus.isSyncing = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: false,
      uploaded: 0,
      downloaded: 0,
      errors: []
    };

    try {
      // 1. Upload local changes to Supabase
      const uploadResult = await this.uploadLocalChanges();
      result.uploaded = uploadResult.count;
      if (uploadResult.errors.length > 0) {
        result.errors.push(...uploadResult.errors);
      }

      // 2. Download remote changes from Supabase
      const downloadResult = await this.downloadRemoteChanges();
      result.downloaded = downloadResult.count;
      if (downloadResult.errors.length > 0) {
        result.errors.push(...downloadResult.errors);
      }

      // 3. Update sync status
      this.syncStatus.lastSync = new Date();
      this.syncStatus.pendingChanges = await this.countPendingChanges();
      localStorage.setItem('lastSyncTime', this.syncStatus.lastSync.toISOString());

      result.success = result.errors.length === 0;
    } catch (error) {
      console.error('Sync error:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.syncStatus.isSyncing = false;
      this.notifyListeners();
    }

    return result;
  }

  private async uploadLocalChanges(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let uploadCount = 0;

    try {
      // Get pending local data from IndexedDB
      const pendingData = await this.indexedDbService.getPendingUploads();

      for (const item of pendingData) {
        try {
          switch (item.type) {
            case 'banking_file':
              await supabaseDataService.uploadBankingFile(
                item.data.fileName,
                item.data.transactions,
                item.data.operationDate
              );
              break;

            case 'manual_entry':
              await supabaseDataService.addManualEntry(item.data);
              break;

            case 'conference':
              await supabaseDataService.transferToConference(item.data.transactionId);
              break;

            case 'not_found':
              await supabaseDataService.registerNotFound(
                item.data.searchedValue,
                item.data.normalizedValue
              );
              break;
          }

          // Mark as uploaded in IndexedDB
          await this.indexedDbService.markAsUploaded(item.id);
          uploadCount++;
        } catch (error) {
          errors.push(`Failed to upload ${item.type}: ${error}`);
        }
      }
    } catch (error) {
      errors.push(`Upload error: ${error}`);
    }

    return { count: uploadCount, errors };
  }

  private async downloadRemoteChanges(): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let downloadCount = 0;

    try {
      // Get last sync time
      const lastSync = this.syncStatus.lastSync || new Date(0);

      // Download new conferences
      const conferences = await supabaseDataService.getActiveConferences();
      for (const conf of conferences) {
        const confDate = new Date(conf.created_at);
        if (confDate > lastSync) {
          await this.indexedDbService.saveRemoteConference(conf);
          downloadCount++;
        }
      }

      // Download manual entries
      const entries = await supabaseDataService.getManualEntries();
      for (const entry of entries) {
        const entryDate = new Date(entry.created_at);
        if (entryDate > lastSync) {
          await this.indexedDbService.saveRemoteEntry(entry);
          downloadCount++;
        }
      }

      // Download not found history
      const notFound = await supabaseDataService.getNotFoundHistory();
      for (const item of notFound) {
        const itemDate = new Date(item.created_at);
        if (itemDate > lastSync) {
          await this.indexedDbService.saveRemoteNotFound(item);
          downloadCount++;
        }
      }
    } catch (error) {
      errors.push(`Download error: ${error}`);
    }

    return { count: downloadCount, errors };
  }

  private async countPendingChanges(): Promise<number> {
    try {
      const pending = await this.indexedDbService.getPendingUploads();
      return pending.length;
    } catch (error) {
      console.error('Error counting pending changes:', error);
      return 0;
    }
  }

  // Queue operations for offline support
  async queueOperation(type: string, data: any) {
    if (this.syncStatus.isOnline) {
      // If online, execute immediately
      try {
        switch (type) {
          case 'manual_entry':
            await supabaseDataService.addManualEntry(data);
            break;
          case 'conference':
            await supabaseDataService.transferToConference(data.transactionId);
            break;
          case 'not_found':
            await supabaseDataService.registerNotFound(data.searchedValue, data.normalizedValue);
            break;
        }
      } catch (error) {
        // If online operation fails, queue for later
        await this.indexedDbService.queueForUpload(type, data);
        this.syncStatus.pendingChanges++;
        this.notifyListeners();
      }
    } else {
      // If offline, queue for later
      await this.indexedDbService.queueForUpload(type, data);
      this.syncStatus.pendingChanges++;
      this.notifyListeners();
    }
  }

  // Status management
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  onSyncStatusChange(listener: (status: SyncStatus) => void) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private notifyListeners() {
    const status = this.getSyncStatus();
    this.syncListeners.forEach(listener => listener(status));
  }

  // Conflict resolution
  async resolveConflicts(strategy: 'local' | 'remote' | 'merge' = 'merge') {
    // This would implement conflict resolution logic
    // For now, we'll use a simple last-write-wins strategy
    console.log('Resolving conflicts with strategy:', strategy);
  }

  // Force sync
  async forceSyncNow(): Promise<SyncResult> {
    return this.syncData();
  }

  // Clear local cache
  async clearLocalCache() {
    await this.indexedDbService.clearAll();
    this.syncStatus.pendingChanges = 0;
    this.syncStatus.lastSync = null;
    localStorage.removeItem('lastSyncTime');
    this.notifyListeners();
  }

  // Cleanup
  destroy() {
    this.stopPeriodicSync();
    this.syncListeners.clear();
  }
}

export const syncService = new SyncService();