import { getCurrentUserId } from './database';
import { initializeDatabase, isIndexedDBAvailable } from './indexeddb';
import IndexedDbService, { ConferenceHistoryEntry, DailyOperationsSummary } from '../services/indexedDbService';
import { ConferenceHistoryService } from '../services/conferenceHistory';

// Storage adapter que escolhe entre IndexedDB e Supabase automaticamente
export class StorageAdapter {
  private static useIndexedDB: boolean = false;
  private static initialized: boolean = false;

  // Inicializar o adaptador
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Tentar inicializar IndexedDB primeiro
      if (isIndexedDBAvailable()) {
        const success = await initializeDatabase();
        if (success) {
          this.useIndexedDB = true;
          console.log('Using IndexedDB for storage');

          // Configurar user ID no IndexedDbService
          const userId = await getCurrentUserId();
          IndexedDbService.setCurrentUserId(userId);
        } else {
          console.log('IndexedDB initialization failed, falling back to Supabase');
          this.useIndexedDB = false;
        }
      } else {
        console.log('IndexedDB not available, using Supabase');
        this.useIndexedDB = false;
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing storage adapter:', error);
      this.useIndexedDB = false;
      this.initialized = true;
    }
  }

  // Verificar qual storage está sendo usado
  static isUsingIndexedDB(): boolean {
    return this.useIndexedDB;
  }

  // Forçar uso do IndexedDB (para testes)
  static forceIndexedDB(force: boolean = true): void {
    this.useIndexedDB = force && isIndexedDBAvailable();
  }

  // === OPERAÇÕES DE UPLOAD BANCÁRIO ===

  static async saveBankingUpload(
    data: any[],
    fileName: string,
    operationDate: string,
    uploadMode: 'automatic' | 'manual'
  ): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.saveBankingUpload(data, fileName, operationDate, uploadMode);
    } else {
      return ConferenceHistoryService.saveBankingUpload(data, fileName, operationDate, uploadMode);
    }
  }

  // === OPERAÇÕES DE CONFERÊNCIA DE CAIXA ===

  static async saveCashConference(
    item: any,
    operationDate: string,
    status: 'conferred' | 'not_found'
  ): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.saveCashConference(item, operationDate, status);
    } else {
      return ConferenceHistoryService.saveCashConference(item, operationDate, status);
    }
  }

  // === OPERAÇÕES DE VALORES NÃO ENCONTRADOS ===

  static async saveNotFound(
    value: string,
    operationDate: string
  ): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.saveNotFound(value, operationDate);
    } else {
      return ConferenceHistoryService.saveNotFound(value, operationDate);
    }
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

    if (this.useIndexedDB) {
      return IndexedDbService.saveManualEntry(entry, operationDate);
    } else {
      // Para Supabase, usar o ConferenceHistoryService (pode ser estendido no futuro)
      throw new Error('Manual entries not yet implemented for Supabase');
    }
  }

  // === OPERAÇÕES DE CONSULTA ===

  static async getHistoryByDate(date: string): Promise<ConferenceHistoryEntry[]> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.getHistoryByDate(date);
    } else {
      return ConferenceHistoryService.getHistoryByDate(date);
    }
  }

  static async getDailySummary(date: string): Promise<DailyOperationsSummary | null> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.getDailySummary(date);
    } else {
      return ConferenceHistoryService.getDailySummary(date);
    }
  }

  static async getHistoryByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ConferenceHistoryEntry[]> {
    await this.initialize();

    if (this.useIndexedDB) {
      // Implementar busca por range no IndexedDbService se necessário
      const results: ConferenceHistoryEntry[] = [];
      const start = new Date(startDate.split('-').reverse().join('-'));
      const end = new Date(endDate.split('-').reverse().join('-'));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const dayHistory = await IndexedDbService.getHistoryByDate(dateStr);
        results.push(...dayHistory);
      }

      return results.sort((a, b) => {
        const timeA = new Date(a.operation_timestamp || '').getTime();
        const timeB = new Date(b.operation_timestamp || '').getTime();
        return timeB - timeA;
      });
    } else {
      return ConferenceHistoryService.getHistoryByDateRange(startDate, endDate);
    }
  }

  // === OPERAÇÕES DE ATUALIZAÇÃO ===

  static async updateConferenceStatus(
    id: string | number,
    status: 'conferred' | 'not_found' | 'pending'
  ): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      // Para IndexedDB, precisamos do source. Por simplicidade, assumir banking_upload
      // Em implementação real, seria passado como parâmetro
      return IndexedDbService.updateConferenceStatus(id, status, 'banking_upload');
    } else {
      return ConferenceHistoryService.updateConferenceStatus(String(id), status);
    }
  }

  // === OPERAÇÕES DE LIMPEZA ===

  static async clearDayHistory(date: string): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.clearDayHistory(date);
    } else {
      return ConferenceHistoryService.clearDayHistory(date);
    }
  }

  static async deleteHistoryEntry(id: string | number): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      // Para IndexedDB, precisamos do source. Por simplicidade, assumir banking_upload
      // Em implementação real, seria passado como parâmetro
      return IndexedDbService.deleteHistoryEntry(id, 'banking_upload');
    } else {
      return ConferenceHistoryService.deleteHistoryEntry(String(id));
    }
  }

  // === OPERAÇÕES DE SELEÇÃO DE DATA ===

  static async saveDaySelection(day: string, selectedDate: string): Promise<void> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.saveDaySelection(day, selectedDate);
    } else {
      // Para Supabase, salvar no localStorage como fallback
      try {
        const key = `day_selection_${day}`;
        const data = { day, selectedDate, timestamp: new Date().toISOString() };
        localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save day selection:', error);
      }
    }
  }

  static async getDaySelection(day: string): Promise<{ day: string; selected_date: string } | null> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.getDaySelection(day);
    } else {
      // Para Supabase, ler do localStorage como fallback
      try {
        const key = `day_selection_${day}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          return { day: data.day, selected_date: data.selectedDate };
        }
      } catch (error) {
        console.warn('Failed to get day selection:', error);
      }
      return null;
    }
  }

  // === OPERAÇÕES DE BUSCA ===

  static async searchByValue(value: number, date?: string): Promise<ConferenceHistoryEntry[]> {
    await this.initialize();

    if (this.useIndexedDB) {
      return IndexedDbService.searchByValue(value, date);
    } else {
      // Para Supabase, implementar busca básica
      const history = date
        ? await ConferenceHistoryService.getHistoryByDate(date)
        : await ConferenceHistoryService.getHistoryByDateRange(
            new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          );

      return history.filter(entry => entry.value === value);
    }
  }

  // === ESTATÍSTICAS ===

  static async getStorageStats(): Promise<{
    type: 'IndexedDB' | 'Supabase';
    stats?: any;
  }> {
    await this.initialize();

    if (this.useIndexedDB) {
      const stats = await IndexedDbService.getStats();
      return { type: 'IndexedDB', stats };
    } else {
      return { type: 'Supabase' };
    }
  }

  // === MIGRAÇÃO DE DADOS ===

  static async migrateToIndexedDB(): Promise<void> {
    if (!isIndexedDBAvailable()) {
      throw new Error('IndexedDB is not available');
    }

    // Implementar migração de dados do Supabase para IndexedDB se necessário
    console.log('Migration to IndexedDB would be implemented here');
  }

  static async migrateToSupabase(): Promise<void> {
    if (!this.useIndexedDB) {
      throw new Error('Not using IndexedDB');
    }

    // Implementar migração de dados do IndexedDB para Supabase se necessário
    console.log('Migration to Supabase would be implemented here');
  }
}

export default StorageAdapter;