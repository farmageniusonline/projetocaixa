import { db, getCurrentUserId } from '../lib/database';

export interface ConferenceHistoryEntry {
  id?: string;
  operation_date: string;
  operation_type: 'banking_upload' | 'cash_conference' | 'not_found';
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
  status?: 'conferred' | 'not_found' | 'pending';

  // File upload info
  file_name?: string;
  file_upload_date?: string;
  upload_mode?: 'automatic' | 'manual';

  // Metadata
  metadata?: any;
  user_id?: string;
}

export interface DailyOperationsSummary {
  operation_date: string;
  banking_total_uploaded: number;
  banking_total_value: number;
  banking_conferred_count: number;
  banking_conferred_value: number;
  cash_conferred_count: number;
  cash_conferred_value: number;
  cash_not_found_count: number;
  last_file_name?: string;
  last_upload_timestamp?: string;
  total_conferred?: number;
  total_value?: number;
}

export class ConferenceHistoryService {
  // Save banking upload data
  static async saveBankingUpload(
    data: any[],
    fileName: string,
    operationDate: string,
    uploadMode: 'automatic' | 'manual'
  ): Promise<void> {
    const userId = await getCurrentUserId();

    const entries: ConferenceHistoryEntry[] = data.map(item => ({
      operation_date: operationDate,
      operation_type: 'banking_upload',
      document_number: item.documentNumber,
      date: item.date,
      description: item.description,
      value: item.value,
      bank_name: item.bankName,
      account_number: item.accountNumber,
      transaction_type: item.transactionType,
      balance: item.balance,
      file_name: fileName,
      file_upload_date: operationDate,
      upload_mode: uploadMode,
      status: 'pending',
      user_id: userId,
      metadata: item
    }));

    const { error } = await db
      .from('conference_history')
      .insert(entries);

    if (error) {
      console.error('Error saving banking upload:', error);
      throw error;
    }
  }

  // Save cash conference
  static async saveCashConference(
    item: any,
    operationDate: string,
    status: 'conferred' | 'not_found'
  ): Promise<void> {
    const userId = await getCurrentUserId();

    const entry: ConferenceHistoryEntry = {
      operation_date: operationDate,
      operation_type: 'cash_conference',
      document_number: item.documentNumber,
      description: item.description,
      value: item.value,
      conferred_at: new Date().toISOString(),
      conferred_by: userId,
      status: status,
      user_id: userId,
      metadata: item
    };

    const { error } = await db
      .from('conference_history')
      .insert(entry);

    if (error) {
      console.error('Error saving cash conference:', error);
      throw error;
    }
  }

  // Save not found value
  static async saveNotFound(
    value: string,
    operationDate: string
  ): Promise<void> {
    const userId = await getCurrentUserId();

    const numericValue = parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));

    const entry: ConferenceHistoryEntry = {
      operation_date: operationDate,
      operation_type: 'not_found',
      value: isNaN(numericValue) ? 0 : numericValue,
      status: 'not_found',
      user_id: userId,
      metadata: { originalValue: value }
    };

    const { error } = await db
      .from('conference_history')
      .insert(entry);

    if (error) {
      console.error('Error saving not found value:', error);
      throw error;
    }
  }

  // Get history by date
  static async getHistoryByDate(date: string): Promise<ConferenceHistoryEntry[]> {
    const userId = await getCurrentUserId();

    const { data, error } = await db
      .from('conference_history')
      .select('*')
      .eq('operation_date', date)
      .eq('user_id', userId)
      .order('operation_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      throw error;
    }

    return data || [];
  }

  // Get daily summary
  static async getDailySummary(date: string): Promise<DailyOperationsSummary | null> {
    const userId = await getCurrentUserId();

    const { data, error } = await db
      .from('daily_summary')
      .select('*')
      .eq('operation_date', date)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching daily summary:', error);
      throw error;
    }

    return data;
  }

  // Get date range history
  static async getHistoryByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ConferenceHistoryEntry[]> {
    const userId = await getCurrentUserId();

    const { data, error } = await db
      .from('conference_history')
      .select('*')
      .gte('operation_date', startDate)
      .lte('operation_date', endDate)
      .eq('user_id', userId)
      .order('operation_date', { ascending: false })
      .order('operation_timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching history range:', error);
      throw error;
    }

    return data || [];
  }

  // Update conference status
  static async updateConferenceStatus(
    id: string,
    status: 'conferred' | 'not_found' | 'pending'
  ): Promise<void> {
    const userId = await getCurrentUserId();

    const { error } = await db
      .from('conference_history')
      .update({
        status,
        updated_at: new Date().toISOString(),
        conferred_at: status === 'conferred' ? new Date().toISOString() : null,
        conferred_by: status === 'conferred' ? userId : null
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating conference status:', error);
      throw error;
    }
  }

  // Delete history entry
  static async deleteHistoryEntry(id: string): Promise<void> {
    const userId = await getCurrentUserId();

    const { error } = await db
      .from('conference_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting history entry:', error);
      throw error;
    }
  }

  // Clear day history
  static async clearDayHistory(date: string): Promise<void> {
    const userId = await getCurrentUserId();

    const { error } = await db
      .from('conference_history')
      .delete()
      .eq('operation_date', date)
      .eq('user_id', userId);

    if (error) {
      console.error('Error clearing day history:', error);
      throw error;
    }
  }
}