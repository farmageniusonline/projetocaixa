import IndexedDbService from './indexedDbService';
import { supabaseDataService } from './supabaseDataService';
import { syncService } from './syncService';
import { authService } from './authService';

type DataMode = 'indexeddb' | 'supabase' | 'hybrid';

class DataAdapter {
  private mode: DataMode = 'indexeddb'; // Default to IndexedDB for backward compatibility

  constructor() {
    this.initializeMode();
  }

  private initializeMode() {
    // Check environment variable for database mode
    const envMode = import.meta.env.VITE_DATABASE_MODE;

    if (envMode === 'supabase' && authService.isAuthenticated()) {
      this.mode = 'supabase';
    } else if (envMode === 'hybrid') {
      this.mode = 'hybrid';
    } else {
      this.mode = 'indexeddb';
    }
  }

  setMode(mode: DataMode) {
    this.mode = mode;
  }

  getMode(): DataMode {
    return this.mode;
  }

  // === BANKING UPLOAD OPERATIONS ===

  async saveBankingUpload(
    data: any[],
    fileName: string,
    operationDate: string,
    uploadMode: 'automatic' | 'manual'
  ): Promise<void> {
    if (this.mode === 'supabase') {
      await supabaseDataService.uploadBankingFile(
        fileName,
        data,
        new Date(operationDate)
      );
    } else if (this.mode === 'hybrid') {
      // Save locally first
      await IndexedDbService.saveBankingUpload(data, fileName, operationDate, uploadMode);
      // Queue for sync
      await syncService.queueOperation('banking_file', {
        fileName,
        transactions: data,
        operationDate: new Date(operationDate)
      });
    } else {
      await IndexedDbService.saveBankingUpload(data, fileName, operationDate, uploadMode);
    }
  }

  // === CASH CONFERENCE OPERATIONS ===

  async saveCashConference(
    item: any,
    operationDate: string,
    status: 'conferred' | 'not_found'
  ): Promise<void> {
    if (this.mode === 'supabase') {
      if (status === 'conferred' && item.id) {
        await supabaseDataService.transferToConference(item.id);
      } else if (status === 'not_found') {
        await supabaseDataService.registerNotFound(
          item.value?.toString() || '0',
          item.value || 0
        );
      }
    } else if (this.mode === 'hybrid') {
      // Save locally first
      await IndexedDbService.saveCashConference(item, operationDate, status);
      // Queue for sync
      if (status === 'conferred' && item.id) {
        await syncService.queueOperation('conference', { transactionId: item.id });
      } else if (status === 'not_found') {
        await syncService.queueOperation('not_found', {
          searchedValue: item.value?.toString() || '0',
          normalizedValue: item.value || 0
        });
      }
    } else {
      await IndexedDbService.saveCashConference(item, operationDate, status);
    }
  }

  // === NOT FOUND OPERATIONS ===

  async saveNotFound(value: string, operationDate: string): Promise<void> {
    const numericValue = parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));

    if (this.mode === 'supabase') {
      await supabaseDataService.registerNotFound(value, numericValue);
    } else if (this.mode === 'hybrid') {
      // Save locally first
      await IndexedDbService.saveNotFound(value, operationDate);
      // Queue for sync
      await syncService.queueOperation('not_found', {
        searchedValue: value,
        normalizedValue: numericValue
      });
    } else {
      await IndexedDbService.saveNotFound(value, operationDate);
    }
  }

  // === MANUAL ENTRY OPERATIONS ===

  async saveManualEntry(
    entry: {
      document_number?: string;
      description?: string;
      value: number;
      entry_type: 'income' | 'expense' | 'transfer';
      category?: string;
      isLink?: boolean;
    },
    operationDate: string
  ): Promise<void> {
    if (this.mode === 'supabase') {
      await supabaseDataService.addManualEntry({
        documentNumber: entry.document_number,
        description: entry.description || '',
        value: entry.value,
        entryType: entry.entry_type,
        category: entry.category,
        isLink: entry.isLink
      });
    } else if (this.mode === 'hybrid') {
      // Save locally first
      await IndexedDbService.saveManualEntry(entry, operationDate);
      // Queue for sync
      await syncService.queueOperation('manual_entry', {
        documentNumber: entry.document_number,
        description: entry.description,
        value: entry.value,
        entryType: entry.entry_type,
        category: entry.category,
        isLink: entry.isLink
      });
    } else {
      await IndexedDbService.saveManualEntry(entry, operationDate);
    }
  }

  // === QUERY OPERATIONS ===

  async getHistoryByDate(date: string): Promise<any[]> {
    if (this.mode === 'supabase') {
      const dateObj = new Date(date);
      const transactions = await supabaseDataService.getTransactionsByDateRange(
        dateObj,
        dateObj
      );
      const conferences = await supabaseDataService.getActiveConferences();
      const entries = await supabaseDataService.getManualEntries(dateObj);

      // Combine and format results
      return [
        ...transactions.map(t => ({
          ...t,
          operation_type: 'banking_upload'
        })),
        ...conferences.map(c => ({
          ...c,
          operation_type: 'cash_conference'
        })),
        ...entries.map(e => ({
          ...e,
          operation_type: 'manual_entry'
        }))
      ];
    } else {
      return await IndexedDbService.getHistoryByDate(date);
    }
  }

  async getDailySummary(date: string): Promise<any> {
    if (this.mode === 'supabase') {
      const stats = await supabaseDataService.getUserStatistics();
      if (!stats) return null;

      return {
        operation_date: date,
        banking_total_uploaded: Number(stats.total_transactions),
        banking_conferred_count: Number(stats.total_conferred),
        total_value: Number(stats.total_value),
        total_conferred: Number(stats.total_conferred)
      };
    } else {
      return await IndexedDbService.getDailySummary(date);
    }
  }

  async searchByValue(value: number, tolerance = 0.01): Promise<any[]> {
    if (this.mode === 'supabase') {
      return await supabaseDataService.searchTransactionsByValue(value, tolerance);
    } else {
      return await IndexedDbService.searchByValue(value);
    }
  }

  // === WORK DAY OPERATIONS ===

  async restartWorkDay(date: string): Promise<void> {
    if (this.mode === 'supabase') {
      await supabaseDataService.restartWorkDay();
    } else if (this.mode === 'hybrid') {
      await IndexedDbService.clearDayHistory(date);
      await supabaseDataService.restartWorkDay();
    } else {
      await IndexedDbService.clearDayHistory(date);
    }
  }

  // === SYNC OPERATIONS ===

  async syncNow(): Promise<any> {
    if (this.mode === 'hybrid' || this.mode === 'supabase') {
      return await syncService.forceSyncNow();
    }
    return { success: true, uploaded: 0, downloaded: 0, errors: [] };
  }

  getSyncStatus() {
    if (this.mode === 'hybrid' || this.mode === 'supabase') {
      return syncService.getSyncStatus();
    }
    return {
      lastSync: null,
      pendingChanges: 0,
      isOnline: true,
      isSyncing: false
    };
  }

  onSyncStatusChange(listener: (status: any) => void) {
    if (this.mode === 'hybrid' || this.mode === 'supabase') {
      return syncService.onSyncStatusChange(listener);
    }
    return () => {}; // No-op unsubscribe
  }

  // === UNDO OPERATIONS ===

  async undoManualEntry(sourceId: string): Promise<void> {
    if (this.mode === 'supabase') {
      await supabaseDataService.deleteManualEntry(sourceId);
    } else {
      await IndexedDbService.undoManualEntry(sourceId);
    }
  }

  // === STATISTICS ===

  async getStats() {
    if (this.mode === 'supabase') {
      const stats = await supabaseDataService.getUserStatistics();
      if (!stats) {
        return {
          bank_uploads: 0,
          bank_entries: 0,
          cash_conference_entries: 0,
          not_found_history: 0,
          manual_entries: 0,
          day_selection: 0,
          total_storage_mb: 0
        };
      }

      return {
        bank_uploads: 0, // Not tracked separately in Supabase
        bank_entries: Number(stats.total_transactions),
        cash_conference_entries: Number(stats.total_conferred),
        not_found_history: Number(stats.total_not_found),
        manual_entries: 0, // Would need separate query
        day_selection: 0,
        total_storage_mb: 0
      };
    } else {
      return await IndexedDbService.getStats();
    }
  }

  // === CONFERENCE SEARCH OPERATIONS ===

  async searchConferenceValue(searchValue: string, _date?: string): Promise<any[]> {
    // Normalize the search value - handle Brazilian decimal format and remove currency symbols
    const normalizedValue = parseFloat(
      searchValue
        .replace(/[R$\s]/g, '') // Remove R$ and spaces
        .replace(',', '.') // Convert comma to dot for decimal
        .replace(/[^\d.-]/g, '') // Remove any non-numeric characters except dots and dashes
    );

    if (isNaN(normalizedValue)) {
      throw new Error('Valor inválido para busca');
    }

    if (this.mode === 'supabase') {
      return await supabaseDataService.searchTransactionsByValue(normalizedValue, 0.01);
    } else {
      // For IndexedDB, implement tolerance-based search
      const tolerance = 0.01;
      const results = await IndexedDbService.searchByValue(normalizedValue, _date);

      // If no exact match found, try tolerance-based search
      if (results.length === 0) {
        // Convert to cents for precision comparison
        const searchCents = Math.round(normalizedValue * 100);
        const toleranceCents = Math.round(tolerance * 100);

        // Get all entries for the date and filter by value range
        const allEntries = _date
          ? await IndexedDbService.getHistoryByDate(_date)
          : await IndexedDbService.getHistoryByDate(new Date().toISOString().split('T')[0]);

        const toleranceResults = allEntries.filter(entry => {
          if (!entry.value) return false;
          const entryCents = Math.round(entry.value * 100);
          return Math.abs(entryCents - searchCents) <= toleranceCents;
        });

        return toleranceResults;
      }

      return results;
    }
  }

  // === EXPORT OPERATIONS ===

  async exportConferences(startDate?: Date, endDate?: Date) {
    if (this.mode === 'supabase') {
      return await supabaseDataService.exportConferences(startDate, endDate);
    } else {
      // For IndexedDB, get all conferences and filter
      const allHistory = await IndexedDbService.getHistoryByDate(
        new Date().toISOString().split('T')[0]
      );
      return allHistory.filter((h: any) => h.operation_type === 'cash_conference');
    }
  }
}

export const dataAdapter = new DataAdapter();
export default dataAdapter;