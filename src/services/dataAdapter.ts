import { supabaseDataService } from './supabaseDataService';

type DataMode = 'supabase';

class DataAdapter {
  private mode: DataMode = 'supabase';

  constructor() {
    this.initializeMode();
  }

  private initializeMode() {
    console.log('DataAdapter: Using Supabase only mode');
    this.mode = 'supabase';
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
    await supabaseDataService.uploadBankingFile(
      fileName,
      data,
      new Date(operationDate)
    );
  }

  // === CASH CONFERENCE OPERATIONS ===

  async saveCashConference(
    item: any,
    operationDate: string,
    status: 'conferred' | 'not_found'
  ): Promise<void> {
    if (status === 'conferred' && item.id) {
      await supabaseDataService.transferToConference(item.id);
    } else if (status === 'not_found') {
      await supabaseDataService.registerNotFound(
        item.value?.toString() || '0',
        item.value || 0
      );
    }
  }

  // === NOT FOUND OPERATIONS ===

  async saveNotFound(value: string, operationDate: string): Promise<void> {
    const numericValue = parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));
    await supabaseDataService.registerNotFound(value, numericValue);
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
    await supabaseDataService.addManualEntry({
      documentNumber: entry.document_number,
      description: entry.description || '',
      value: entry.value,
      entryType: entry.entry_type,
      category: entry.category,
      isLink: entry.isLink
    });
  }

  // === QUERY OPERATIONS ===

  async getHistoryByDate(date: string): Promise<any[]> {
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
  }

  async getDailySummary(date: string): Promise<any> {
    const stats = await supabaseDataService.getUserStatistics();
    if (!stats) return null;

    return {
      operation_date: date,
      banking_total_uploaded: Number(stats.total_transactions),
      banking_conferred_count: Number(stats.total_conferred),
      total_value: Number(stats.total_value),
      total_conferred: Number(stats.total_conferred)
    };
  }

  async searchByValue(value: number, tolerance = 0.01): Promise<any[]> {
    return await supabaseDataService.searchTransactionsByValue(value, tolerance);
  }

  // === WORK DAY OPERATIONS ===

  async restartWorkDay(date: string): Promise<void> {
    await supabaseDataService.restartWorkDay();
  }

  // === SYNC OPERATIONS ===

  async syncNow(): Promise<any> {
    return { success: true, uploaded: 0, downloaded: 0, errors: [] };
  }

  getSyncStatus() {
    return {
      lastSync: null,
      pendingChanges: 0,
      isOnline: true,
      isSyncing: false
    };
  }

  onSyncStatusChange(listener: (status: any) => void) {
    return () => {}; // No-op unsubscribe
  }

  // === UNDO OPERATIONS ===

  async undoManualEntry(sourceId: string): Promise<void> {
    await supabaseDataService.deleteManualEntry(sourceId);
  }

  // === STATISTICS ===

  async getStats() {
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

    return await supabaseDataService.searchTransactionsByValue(normalizedValue, 0.01);
  }

  // === EXPORT OPERATIONS ===

  async exportConferences(startDate?: Date, endDate?: Date) {
    return await supabaseDataService.exportConferences(startDate, endDate);
  }
}

export const dataAdapter = new DataAdapter();
export default dataAdapter;