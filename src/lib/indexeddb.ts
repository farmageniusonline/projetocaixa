import Dexie, { Table } from 'dexie';

// Definição das interfaces baseadas na estrutura atual
export interface BankUpload {
  id?: number;
  day: string; // DD-MM-YYYY
  bank_name?: string;
  account_number?: string;
  file_name: string;
  file_upload_date: string;
  upload_mode: 'automatic' | 'manual';
  user_id: string;
  metadata?: any;
  created_at?: string;
}

export interface BankEntry {
  id?: number;
  upload_id: number; // FK para BankUpload
  source_id?: string; // origin_hash for deduplication
  day: string; // DD-MM-YYYY
  document_number?: string;
  date?: string;
  description?: string;
  value_cents: number; // valor em centavos para busca exata
  value?: number; // valor original
  transaction_type?: string;
  balance?: number;
  status: 'pending' | 'conferred' | 'not_found' | 'transferred';
  conferred_at?: string;
  conferred_by?: string;
  source: 'banking_upload';
  user_id: string;
  metadata?: any;
  created_at?: string;
}

export interface CashConferenceEntry {
  id?: number;
  source_id: string; // origin_hash or manual_id for UNIQUE constraint
  day: string; // DD-MM-YYYY
  document_number?: string;
  description?: string;
  value_cents: number; // valor em centavos para busca exata
  value?: number; // valor original
  status: 'conferred' | 'not_found';
  conferred_at?: string;
  conferred_by?: string;
  source: 'cash_conference';
  user_id: string;
  metadata?: any;
  created_at?: string;
}

export interface NotFoundHistoryEntry {
  id?: number;
  day: string; // DD-MM-YYYY
  value_cents: number; // valor em centavos para busca exata
  value?: number; // valor original
  status: 'not_found';
  source: 'not_found_manual';
  user_id: string;
  metadata?: any;
  created_at?: string;
}

export interface ManualEntry {
  id?: number;
  source_id: string; // manual_id (UUID) for unique identification
  day: string; // DD-MM-YYYY
  document_number?: string;
  description?: string;
  value_cents: number; // valor em centavos para busca exata
  value?: number; // valor original
  entry_type: 'income' | 'expense' | 'transfer';
  category?: string;
  status: 'active' | 'cancelled';
  source: 'manual_entry';
  user_id: string;
  metadata?: any;
  created_at?: string;
}

export interface DaySelection {
  id?: number;
  day: string; // DD-MM-YYYY - PK
  selected_date: string; // ISO date
  user_id: string;
  last_accessed?: string;
  metadata?: any;
}

export interface ActionLog {
  id?: number;
  action_type: 'banking_upload' | 'cash_conference' | 'manual_entry' | 'transfer' | 'undo' | 'not_found';
  action_description: string;
  user_id: string;
  timestamp: string; // ISO date
  day: string; // DD-MM-YYYY for filtering
  payload: {
    source_ids?: string[];
    values?: number[];
    file_name?: string;
    entry_count?: number;
    original_status?: string;
    target_status?: string;
    [key: string]: any;
  };
  result: 'success' | 'error' | 'warning';
  error_message?: string;
  metadata?: any;
}

// Database class
export class CaixaDatabase extends Dexie {
  bank_uploads!: Table<BankUpload>;
  bank_entries!: Table<BankEntry>;
  cash_conference_entries!: Table<CashConferenceEntry>;
  not_found_history!: Table<NotFoundHistoryEntry>;
  manual_entries!: Table<ManualEntry>;
  day_selection!: Table<DaySelection>;
  action_log!: Table<ActionLog>;

  constructor() {
    super('CaixaDatabase');

    // Version 1: Schema inicial
    this.version(1).stores({
      bank_uploads: '++id, day, user_id, file_name, upload_mode, created_at',
      bank_entries: '++id, upload_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      cash_conference_entries: '++id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      not_found_history: '++id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      manual_entries: '++id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      day_selection: '++id, &day, user_id, last_accessed'
    });

    // Version 2: Add source_id fields for deduplication
    this.version(2).stores({
      bank_uploads: '++id, day, user_id, file_name, upload_mode, created_at',
      bank_entries: '++id, upload_id, source_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      cash_conference_entries: '++id, &source_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      not_found_history: '++id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      manual_entries: '++id, &source_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      day_selection: '++id, &day, user_id, last_accessed'
    }).upgrade(trans => {
      // Migration logic for existing data
      console.log('Migrating to version 2: Adding source_id fields');
      return trans.manual_entries.toCollection().modify(entry => {
        if (!entry.source_id) {
          // Generate manual_id for existing manual entries
          entry.source_id = `manual_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
        }
      });
    });

    // Version 3: Add action_log table
    this.version(3).stores({
      bank_uploads: '++id, day, user_id, file_name, upload_mode, created_at',
      bank_entries: '++id, upload_id, source_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      cash_conference_entries: '++id, &source_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      not_found_history: '++id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      manual_entries: '++id, &source_id, day, status, [status+day], value_cents, [value_cents+day], source, [source+day], user_id, created_at',
      day_selection: '++id, &day, user_id, last_accessed',
      action_log: '++id, day, user_id, action_type, timestamp, result, [action_type+day], [result+day]'
    });

    // Hooks para conversão automática de valores
    this.bank_entries.hook('creating', (primKey, obj, trans) => {
      obj.value_cents = Math.round((obj.value || 0) * 100);
      obj.created_at = obj.created_at || new Date().toISOString();
    });

    this.cash_conference_entries.hook('creating', (primKey, obj, trans) => {
      obj.value_cents = Math.round((obj.value || 0) * 100);
      obj.created_at = obj.created_at || new Date().toISOString();
    });

    this.not_found_history.hook('creating', (primKey, obj, trans) => {
      obj.value_cents = Math.round((obj.value || 0) * 100);
      obj.created_at = obj.created_at || new Date().toISOString();
    });

    this.manual_entries.hook('creating', (primKey, obj, trans) => {
      obj.value_cents = Math.round((obj.value || 0) * 100);
      obj.created_at = obj.created_at || new Date().toISOString();
    });

    this.bank_uploads.hook('creating', (primKey, obj, trans) => {
      obj.created_at = obj.created_at || new Date().toISOString();
    });

    this.day_selection.hook('creating', (primKey, obj, trans) => {
      obj.last_accessed = obj.last_accessed || new Date().toISOString();
    });

    // Hooks para atualização automática
    this.bank_entries.hook('updating', (modifications, primKey, obj, trans) => {
      if (modifications.value !== undefined) {
        modifications.value_cents = Math.round((modifications.value || 0) * 100);
      }
    });

    this.cash_conference_entries.hook('updating', (modifications, primKey, obj, trans) => {
      if (modifications.value !== undefined) {
        modifications.value_cents = Math.round((modifications.value || 0) * 100);
      }
    });

    this.not_found_history.hook('updating', (modifications, primKey, obj, trans) => {
      if (modifications.value !== undefined) {
        modifications.value_cents = Math.round((modifications.value || 0) * 100);
      }
    });

    this.manual_entries.hook('updating', (modifications, primKey, obj, trans) => {
      if (modifications.value !== undefined) {
        modifications.value_cents = Math.round((modifications.value || 0) * 100);
      }
    });

    this.day_selection.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.last_accessed = new Date().toISOString();
    });

    this.action_log.hook('creating', (primKey, obj, trans) => {
      obj.timestamp = obj.timestamp || new Date().toISOString();
    });
  }

  // Métodos de utilidade para conversão de valores
  static valueToCents(value: number): number {
    return Math.round(value * 100);
  }

  static centsToValue(cents: number): number {
    return cents / 100;
  }

  // Método para limpar dados de um usuário específico
  async clearUserData(userId: string): Promise<void> {
    await this.transaction('rw', this.bank_uploads, this.bank_entries, this.cash_conference_entries,
                          this.not_found_history, this.manual_entries, this.day_selection, this.action_log, async () => {
      await this.bank_uploads.where('user_id').equals(userId).delete();
      await this.bank_entries.where('user_id').equals(userId).delete();
      await this.cash_conference_entries.where('user_id').equals(userId).delete();
      await this.not_found_history.where('user_id').equals(userId).delete();
      await this.manual_entries.where('user_id').equals(userId).delete();
      await this.day_selection.where('user_id').equals(userId).delete();
      await this.action_log.where('user_id').equals(userId).delete();
    });
  }

  // Método para obter estatísticas do banco
  async getStats(): Promise<{
    bank_uploads: number;
    bank_entries: number;
    cash_conference_entries: number;
    not_found_history: number;
    manual_entries: number;
    day_selection: number;
    action_log: number;
  }> {
    const [
      bank_uploads,
      bank_entries,
      cash_conference_entries,
      not_found_history,
      manual_entries,
      day_selection,
      action_log
    ] = await Promise.all([
      this.bank_uploads.count(),
      this.bank_entries.count(),
      this.cash_conference_entries.count(),
      this.not_found_history.count(),
      this.manual_entries.count(),
      this.day_selection.count(),
      this.action_log.count()
    ]);

    return {
      bank_uploads,
      bank_entries,
      cash_conference_entries,
      not_found_history,
      manual_entries,
      day_selection,
      action_log
    };
  }
}

// Instância global do banco
export const db = new CaixaDatabase();

// Verificar se IndexedDB está disponível
export const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof indexedDB !== 'undefined';
  } catch (e) {
    return false;
  }
};

// Inicializar banco e migrar dados se necessário
export const initializeDatabase = async (): Promise<boolean> => {
  try {
    if (!isIndexedDBAvailable()) {
      console.warn('IndexedDB não está disponível. Mantendo armazenamento em memória.');
      return false;
    }

    await db.open();
    console.log('IndexedDB inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao inicializar IndexedDB:', error);
    return false;
  }
};