import { supabase, supabaseApi } from '../lib/supabase';
import { authService } from './authService';
import type {
  BankingTransaction,
  CashConference,
  Profile
} from '../lib/supabase';
import { normalizeValue } from '../utils/valueNormalizer';
import { performanceLogger } from '../utils/performanceLogger';

export interface FileUploadResult {
  fileId: string;
  fileName: string;
  totalTransactions: number;
  totalValue: number;
}

export interface ConferenceResult {
  conferenceId: string;
  transactionId: string;
  value: number;
}

class SupabaseDataService {
  private userId: string | null = null;

  constructor() {
    this.initializeUser();
  }

  private async initializeUser() {
    const user = authService.getUser();
    if (user) {
      this.userId = user.id;
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      this.userId = session?.user?.id ?? null;
    });
  }

  private ensureAuthenticated() {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }
  }

  // Banking Files Operations
  async uploadBankingFile(
    fileName: string,
    transactions: any[],
    operationDate?: Date
  ): Promise<FileUploadResult> {
    this.ensureAuthenticated();

    const startTime = performance.now();

    try {
      // Calculate totals
      const totalValue = transactions.reduce((sum, t) => sum + (t.value || 0), 0);

      // Create file record
      const { data: fileData, error: fileError } = await supabase
        .from('banking_files')
        .insert({
          user_id: this.userId,
          file_name: fileName,
          operation_date: operationDate?.toISOString().split('T')[0],
          total_transactions: transactions.length,
          total_value: totalValue,
          status: 'processing'
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // Insert transactions
      const { error: transError } = await supabaseApi.insertBankingTransactions(
        this.userId!,
        fileData.id,
        transactions
      );

      if (transError) throw transError;

      // Update file status
      await supabase
        .from('banking_files')
        .update({ status: 'completed' })
        .eq('id', fileData.id);

      const duration = performance.now() - startTime;
      performanceLogger.logOperation('supabase_upload_file', duration, {
        fileName,
        transactionCount: transactions.length
      });

      return {
        fileId: fileData.id,
        fileName: fileData.file_name,
        totalTransactions: fileData.total_transactions,
        totalValue: fileData.total_value
      };
    } catch (error) {
      console.error('Error uploading banking file:', error);
      throw error;
    }
  }

  // Transaction Operations
  async searchTransactionsByValue(value: number, tolerance = 0.01): Promise<BankingTransaction[]> {
    this.ensureAuthenticated();

    const startTime = performance.now();

    try {
      const { data, error } = await supabaseApi.searchTransactionsByValue(
        this.userId!,
        value
      );

      if (error) throw error;

      const duration = performance.now() - startTime;
      performanceLogger.logOperation('supabase_search_value', duration, {
        value,
        resultCount: data?.length || 0
      });

      return data || [];
    } catch (error) {
      console.error('Error searching transactions:', error);
      return [];
    }
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<BankingTransaction[]> {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabase
        .from('banking_transactions')
        .select('*')
        .eq('user_id', this.userId)
        .gte('transaction_date', startDate.toISOString().split('T')[0])
        .lte('transaction_date', endDate.toISOString().split('T')[0])
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting transactions by date:', error);
      return [];
    }
  }

  // Conference Operations
  async transferToConference(transactionId: string): Promise<ConferenceResult | null> {
    this.ensureAuthenticated();

    const startTime = performance.now();

    try {
      const { data, error } = await supabaseApi.transferToConference(
        this.userId!,
        transactionId
      );

      if (error) throw error;

      const duration = performance.now() - startTime;
      performanceLogger.logOperation('supabase_transfer', duration, {
        transactionId
      });

      // Get the created conference details
      const { data: conference, error: confError } = await supabase
        .from('cash_conference')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();

      if (confError) throw confError;

      return {
        conferenceId: conference.id,
        transactionId: conference.transaction_id,
        value: conference.conferred_value
      };
    } catch (error) {
      console.error('Error transferring to conference:', error);
      return null;
    }
  }

  async removeFromConference(conferenceId: string): Promise<boolean> {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabaseApi.removeFromConference(
        this.userId!,
        conferenceId
      );

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error removing from conference:', error);
      return false;
    }
  }

  async getActiveConferences(): Promise<CashConference[]> {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabaseApi.getActiveConferences(this.userId!);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting active conferences:', error);
      return [];
    }
  }

  // Manual Entries Operations
  async addManualEntry(entry: {
    documentNumber?: string;
    description: string;
    value: number;
    entryType: 'income' | 'expense' | 'transfer';
    category?: string;
    isLink?: boolean;
  }) {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabase
        .from('manual_entries')
        .insert({
          user_id: this.userId,
          document_number: entry.documentNumber,
          description: entry.description,
          value: entry.value,
          entry_type: entry.entryType,
          category: entry.category,
          is_link: entry.isLink || false
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error adding manual entry:', error);
      throw error;
    }
  }

  async getManualEntries(date?: Date) {
    this.ensureAuthenticated();

    try {
      let query = supabase
        .from('manual_entries')
        .select('*')
        .eq('user_id', this.userId);

      if (date) {
        const dateStr = date.toISOString().split('T')[0];
        query = query.eq('entry_date', dateStr);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting manual entries:', error);
      return [];
    }
  }

  async deleteManualEntry(entryId: string): Promise<boolean> {
    this.ensureAuthenticated();

    try {
      const { error } = await supabase
        .from('manual_entries')
        .delete()
        .eq('id', entryId)
        .eq('user_id', this.userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting manual entry:', error);
      return false;
    }
  }

  // Not Found History
  async registerNotFound(searchedValue: string, normalizedValue: number) {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabaseApi.registerNotFound(
        this.userId!,
        searchedValue,
        normalizedValue
      );

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error registering not found:', error);
      return null;
    }
  }

  async getNotFoundHistory() {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabaseApi.getNotFoundHistory(this.userId!);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting not found history:', error);
      return [];
    }
  }

  // Statistics
  async getUserStatistics() {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabaseApi.getUserStats(this.userId!);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return null;
    }
  }

  // Work Day Operations
  async restartWorkDay(): Promise<boolean> {
    this.ensureAuthenticated();

    try {
      const { data, error } = await supabaseApi.restartWorkDay(this.userId!);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error restarting work day:', error);
      return false;
    }
  }

  // Performance Logging to Supabase
  async logPerformance(operation: string, duration: number, metadata?: any) {
    try {
      await supabase
        .from('performance_logs')
        .insert({
          user_id: this.userId,
          operation,
          duration_ms: duration,
          metadata
        });
    } catch (error) {
      // Silently fail performance logging
      console.debug('Performance log failed:', error);
    }
  }

  // Audit Logging
  async logAudit(action: string, tableName?: string, recordId?: string, oldData?: any, newData?: any) {
    try {
      await supabase
        .from('audit_logs')
        .insert({
          user_id: this.userId,
          action,
          table_name: tableName,
          record_id: recordId,
          old_data: oldData,
          new_data: newData
        });
    } catch (error) {
      // Silently fail audit logging
      console.debug('Audit log failed:', error);
    }
  }

  // Batch Operations
  async batchTransferToConference(transactionIds: string[]): Promise<ConferenceResult[]> {
    this.ensureAuthenticated();

    const results: ConferenceResult[] = [];

    for (const transactionId of transactionIds) {
      const result = await this.transferToConference(transactionId);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // Export Data
  async exportConferences(startDate?: Date, endDate?: Date) {
    this.ensureAuthenticated();

    try {
      let query = supabase
        .from('cash_conference')
        .select('*')
        .eq('user_id', this.userId);

      if (startDate && endDate) {
        query = query
          .gte('conference_date', startDate.toISOString().split('T')[0])
          .lte('conference_date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query
        .order('conference_date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error exporting conferences:', error);
      return [];
    }
  }
}

export const supabaseDataService = new SupabaseDataService();