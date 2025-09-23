import { supabaseDataService } from '../services/supabaseDataService';
import { ConferenceHistoryService } from '../services/conferenceHistory';

export interface ConferenceHistoryEntry {
  id?: string | number;
  operation_date: string;
  operation_type: 'banking_upload' | 'cash_conference' | 'not_found' | 'manual_entry';
  operation_timestamp?: string;

  // Common fields
  document_number?: string;
  date?: string;
  description?: string;
  value?: number;

  // Banking specific
  bank_name?: string;
  account_number?: string;
  transaction_type?: string;
  balance?: number;

  // Conference specific
  conferred_at?: string;
  conferred_by?: string;
  status?: 'conferred' | 'not_found' | 'pending' | 'active' | 'cancelled' | 'transferred';

  // File upload info
  file_name?: string;
  file_upload_date?: string;
  upload_mode?: 'automatic' | 'manual';

  // Metadata
  metadata?: any;
  user_id?: string;
  source?: string;
}

export interface DailyOperationsSummary {
  date: string;
  banking_uploads: number;
  cash_conferences: number;
  not_found_entries: number;
  manual_entries: number;
  total_operations: number;
  total_value: number;
}

// Storage adapter que usa apenas Supabase
export class StorageAdapter {
  private static initialized: boolean = false;

  // Inicializar o adaptador
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Using Supabase for storage');
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing storage adapter:', error);
      this.initialized = true;
    }
  }

  // === OPERAÇÕES DE UPLOAD BANCÁRIO ===

  static async saveBankingUpload(
    data: any[],
    fileName: string,
    operationDate: string,
    uploadMode: 'automatic' | 'manual'
  ): Promise<void> {
    await this.initialize();
    return ConferenceHistoryService.saveBankingUpload(data, fileName, operationDate, uploadMode);
  }

  // === OPERAÇÕES DE CONFERÊNCIA DE CAIXA ===

  static async saveCashConference(
    item: any,
    operationDate: string,
    status: 'conferred' | 'not_found'
  ): Promise<void> {
    await this.initialize();
    return ConferenceHistoryService.saveCashConference(item, operationDate, status);
  }

  // === OPERAÇÕES DE VALORES NÃO ENCONTRADOS ===

  static async saveNotFound(
    value: string,
    operationDate: string
  ): Promise<void> {
    await this.initialize();
    return ConferenceHistoryService.saveNotFound(value, operationDate);
  }

  // === OPERAÇÕES DE LANÇAMENTOS MANUAIS ===

  static async saveManualEntry(
    entry: {
      document_number?: string;
      description?: string;
      value: number;
      entry_type: 'income' | 'expense' | 'transfer';
      category?: string;
    },
    operationDate: string
  ): Promise<void> {
    await this.initialize();
    // Implementar no ConferenceHistoryService se necessário
    throw new Error('Manual entries not yet implemented for Supabase');
  }

  // === OPERAÇÕES DE CONSULTA ===

  static async getHistoryByDate(date: string): Promise<ConferenceHistoryEntry[]> {
    await this.initialize();
    return ConferenceHistoryService.getHistoryByDate(date);
  }

  static async getDailySummary(date: string): Promise<DailyOperationsSummary | null> {
    await this.initialize();
    return ConferenceHistoryService.getDailySummary(date);
  }

  static async getHistoryByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ConferenceHistoryEntry[]> {
    await this.initialize();
    return ConferenceHistoryService.getHistoryByDateRange(startDate, endDate);
  }

  // === OPERAÇÕES DE ATUALIZAÇÃO ===

  static async updateConferenceStatus(
    id: string | number,
    status: 'conferred' | 'not_found' | 'pending'
  ): Promise<void> {
    await this.initialize();
    return ConferenceHistoryService.updateConferenceStatus(String(id), status);
  }

  // === OPERAÇÕES DE LIMPEZA ===

  static async clearDayHistory(date: string): Promise<void> {
    await this.initialize();
    return ConferenceHistoryService.clearDayHistory(date);
  }

  static async deleteHistoryEntry(id: string | number): Promise<void> {
    await this.initialize();
    return ConferenceHistoryService.deleteHistoryEntry(String(id));
  }

  // === OPERAÇÕES DE SELEÇÃO DE DATA ===

  static async saveDaySelection(day: string, selectedDate: string): Promise<void> {
    await this.initialize();
    // Para Supabase, usar estado em memória
    // Dados de seleção de data são temporários e não precisam persistir
  }

  static async getDaySelection(day: string): Promise<{ day: string; selected_date: string } | null> {
    await this.initialize();
    // Para Supabase, retornar null (usar estado em memória)
    return null;
  }

  // === OPERAÇÕES DE BUSCA ===

  static async searchByValue(value: number, date?: string): Promise<ConferenceHistoryEntry[]> {
    await this.initialize();
    const history = date
      ? await ConferenceHistoryService.getHistoryByDate(date)
      : await ConferenceHistoryService.getHistoryByDateRange(
          new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        );

    return history.filter(entry => entry.value === value);
  }

  // === ESTATÍSTICAS ===

  static async getStorageStats(): Promise<{
    type: 'IndexedDB' | 'Supabase';
    stats?: any;
  }> {
    await this.initialize();
    return { type: 'Supabase' };
  }
}

export default StorageAdapter;