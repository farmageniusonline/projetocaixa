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

    // Convert DD-MM-YYYY to YYYY-MM-DD for database
    const [day, month, year] = operationDate.split('-');
    const dbDate = `${year}-${month}-${day}`;

    // First, create banking file entry
    const { data: fileData, error: fileError } = await db
      .from('banking_files')
      .insert({
        user_id: userId,
        file_name: fileName,
        operation_date: dbDate,
        total_transactions: data.length,
        total_value: data.reduce((sum, item) => sum + (item.value || 0), 0),
        status: 'uploaded',
        metadata: { upload_mode: uploadMode }
      })
      .select('id')
      .single();

    if (fileError) {
      console.error('Error creating banking file:', fileError);
      throw fileError;
    }

    // Then, insert transactions
    const transactions = data.map((item, index) => ({
      file_id: fileData.id,
      user_id: userId,
      transaction_date: dbDate,
      payment_type: item.paymentType || item.transactionType,
      cpf: item.cpf?.replace(/[^0-9]/g, ''),
      value: item.value,
      original_history: item.originalHistory || item.description,
      status: 'pending',
      row_index: index,
      original_data: item
    }));

    const { error } = await db
      .from('banking_transactions')
      .insert(transactions);

    if (error) {
      console.error('Error saving banking transactions:', error);
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

    // Convert DD-MM-YYYY to YYYY-MM-DD for database
    const [day, month, year] = operationDate.split('-');
    const dbDate = `${year}-${month}-${day}`;

    const entry = {
      user_id: userId,
      transaction_id: item.transactionId || null,
      conferred_value: item.value,
      conference_date: dbDate,
      transaction_date: item.date ? (() => {
        const [d, m, y] = item.date.split('-');
        return `${y}-${m}-${d}`;
      })() : dbDate,
      payment_type: item.paymentType,
      cpf: item.cpf?.replace(/[^0-9]/g, ''),
      original_value: item.originalValue || item.value,
      original_history: item.description,
      conference_status: status === 'conferred' ? 'active' : 'cancelled',
      notes: status === 'not_found' ? 'Value not found' : null
    };

    const { error } = await db
      .from('cash_conference')
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

    const entry = {
      user_id: userId,
      searched_value: value,
      normalized_value: isNaN(numericValue) ? 0 : numericValue,
      status: 'not_found',
      notes: `Date: ${operationDate}`
    };

    const { error } = await db
      .from('not_found_history')
      .insert(entry);

    if (error) {
      console.error('Error saving not found value:', error);
      throw error;
    }
  }

  // Get history by date
  static async getHistoryByDate(date: string): Promise<ConferenceHistoryEntry[]> {
    const userId = await getCurrentUserId();

    // Convert DD-MM-YYYY to YYYY-MM-DD for database
    const [day, month, year] = date.split('-');
    const dbDate = `${year}-${month}-${day}`;

    const results: ConferenceHistoryEntry[] = [];

    // Get banking transactions
    const { data: transactions, error: transError } = await db
      .from('banking_transactions')
      .select(`
        *,
        banking_files!inner(file_name, upload_date)
      `)
      .eq('user_id', userId)
      .eq('transaction_date', dbDate)
      .order('created_at', { ascending: false });

    if (transError) {
      console.error('Error fetching transactions:', transError);
      throw transError;
    }

    // Convert transactions to ConferenceHistoryEntry format
    if (transactions) {
      transactions.forEach((trans: any) => {
        results.push({
          id: trans.id,
          operation_date: date,
          operation_type: 'banking_upload',
          document_number: trans.original_data?.documentNumber,
          date: trans.transaction_date,
          description: trans.original_history,
          value: trans.value,
          status: trans.status,
          file_name: trans.banking_files?.file_name,
          user_id: trans.user_id,
          metadata: trans.original_data
        });
      });
    }

    // Get cash conferences
    const { data: conferences, error: confError } = await db
      .from('cash_conference')
      .select('*')
      .eq('user_id', userId)
      .eq('conference_date', dbDate)
      .order('created_at', { ascending: false });

    if (confError) {
      console.error('Error fetching conferences:', confError);
      throw confError;
    }

    // Convert conferences to ConferenceHistoryEntry format
    if (conferences) {
      conferences.forEach((conf: any) => {
        results.push({
          id: conf.id,
          operation_date: date,
          operation_type: 'cash_conference',
          description: conf.original_history,
          value: conf.conferred_value,
          status: conf.conference_status === 'active' ? 'conferred' : 'not_found',
          conferred_at: conf.created_at,
          user_id: conf.user_id
        });
      });
    }

    // Get not found values
    const { data: notFound, error: nfError } = await db
      .from('not_found_history')
      .select('*')
      .eq('user_id', userId)
      .gte('search_timestamp', `${dbDate}T00:00:00`)
      .lt('search_timestamp', `${dbDate}T23:59:59`)
      .order('search_timestamp', { ascending: false });

    if (nfError) {
      console.error('Error fetching not found history:', nfError);
      throw nfError;
    }

    // Convert not found to ConferenceHistoryEntry format
    if (notFound) {
      notFound.forEach((nf: any) => {
        results.push({
          id: nf.id,
          operation_date: date,
          operation_type: 'not_found',
          value: nf.normalized_value,
          status: 'not_found',
          user_id: nf.user_id,
          metadata: { originalValue: nf.searched_value }
        });
      });
    }

    return results.sort((a, b) =>
      new Date(b.conferred_at || b.operation_timestamp || '').getTime() -
      new Date(a.conferred_at || a.operation_timestamp || '').getTime()
    );
  }

  // Get daily summary
  static async getDailySummary(date: string): Promise<DailyOperationsSummary | null> {
    const userId = await getCurrentUserId();

    // Convert DD-MM-YYYY to YYYY-MM-DD for database
    const [day, month, year] = date.split('-');
    const dbDate = `${year}-${month}-${day}`;

    // Get banking transactions summary
    const { data: transStats } = await db
      .from('banking_transactions')
      .select('value, status')
      .eq('user_id', userId)
      .eq('transaction_date', dbDate);

    // Get cash conference summary
    const { data: confStats } = await db
      .from('cash_conference')
      .select('conferred_value, conference_status')
      .eq('user_id', userId)
      .eq('conference_date', dbDate);

    // Get latest file info
    const { data: fileInfo } = await db
      .from('banking_files')
      .select('file_name, upload_date')
      .eq('user_id', userId)
      .eq('operation_date', dbDate)
      .order('upload_date', { ascending: false })
      .limit(1)
      .single();

    const summary: DailyOperationsSummary = {
      operation_date: date,
      banking_total_uploaded: transStats?.length || 0,
      banking_total_value: transStats?.reduce((sum: number, t: any) => sum + t.value, 0) || 0,
      banking_conferred_count: transStats?.filter((t: any) => t.status === 'conferred').length || 0,
      banking_conferred_value: transStats?.filter((t: any) => t.status === 'conferred').reduce((sum: number, t: any) => sum + t.value, 0) || 0,
      cash_conferred_count: confStats?.filter((c: any) => c.conference_status === 'active').length || 0,
      cash_conferred_value: confStats?.filter((c: any) => c.conference_status === 'active').reduce((sum: number, c: any) => sum + c.conferred_value, 0) || 0,
      cash_not_found_count: confStats?.filter((c: any) => c.conference_status === 'cancelled').length || 0,
      last_file_name: fileInfo?.file_name,
      last_upload_timestamp: fileInfo?.upload_date
    };

    summary.total_conferred = summary.banking_conferred_count + summary.cash_conferred_count;
    summary.total_value = summary.banking_total_value + summary.cash_conferred_value;

    return summary;
  }

  // Get date range history
  static async getHistoryByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ConferenceHistoryEntry[]> {
    const userId = await getCurrentUserId();

    // Convert DD-MM-YYYY to YYYY-MM-DD for database
    const [startDay, startMonth, startYear] = startDate.split('-');
    const [endDay, endMonth, endYear] = endDate.split('-');
    const dbStartDate = `${startYear}-${startMonth}-${startDay}`;
    const dbEndDate = `${endYear}-${endMonth}-${endDay}`;

    const results: ConferenceHistoryEntry[] = [];

    // Get banking transactions in range
    const { data: transactions } = await db
      .from('banking_transactions')
      .select('*, banking_files!inner(file_name, upload_date)')
      .eq('user_id', userId)
      .gte('transaction_date', dbStartDate)
      .lte('transaction_date', dbEndDate)
      .order('transaction_date', { ascending: false });

    // Get cash conferences in range
    const { data: conferences } = await db
      .from('cash_conference')
      .select('*')
      .eq('user_id', userId)
      .gte('conference_date', dbStartDate)
      .lte('conference_date', dbEndDate)
      .order('conference_date', { ascending: false });

    // Get not found values in range
    const { data: notFound } = await db
      .from('not_found_history')
      .select('*')
      .eq('user_id', userId)
      .gte('search_timestamp', `${dbStartDate}T00:00:00`)
      .lte('search_timestamp', `${dbEndDate}T23:59:59`)
      .order('search_timestamp', { ascending: false });

    // Convert and combine all data
    if (transactions) {
      transactions.forEach((trans: any) => {
        const [year, month, day] = trans.transaction_date.split('-');
        results.push({
          id: trans.id,
          operation_date: `${day}-${month}-${year}`,
          operation_type: 'banking_upload',
          document_number: trans.original_data?.documentNumber,
          description: trans.original_history,
          value: trans.value,
          status: trans.status,
          file_name: trans.banking_files?.file_name,
          user_id: trans.user_id,
          metadata: trans.original_data
        });
      });
    }

    if (conferences) {
      conferences.forEach((conf: any) => {
        const [year, month, day] = conf.conference_date.split('-');
        results.push({
          id: conf.id,
          operation_date: `${day}-${month}-${year}`,
          operation_type: 'cash_conference',
          description: conf.original_history,
          value: conf.conferred_value,
          status: conf.conference_status === 'active' ? 'conferred' : 'not_found',
          conferred_at: conf.created_at,
          user_id: conf.user_id
        });
      });
    }

    if (notFound) {
      notFound.forEach((nf: any) => {
        const date = new Date(nf.search_timestamp);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
        results.push({
          id: nf.id,
          operation_date: formattedDate,
          operation_type: 'not_found',
          value: nf.normalized_value,
          status: 'not_found',
          user_id: nf.user_id,
          metadata: { originalValue: nf.searched_value }
        });
      });
    }

    return results.sort((a, b) => {
      const dateA = new Date(a.operation_date.split('-').reverse().join('-'));
      const dateB = new Date(b.operation_date.split('-').reverse().join('-'));
      return dateB.getTime() - dateA.getTime();
    });
  }

  // Update conference status
  static async updateConferenceStatus(
    id: string,
    status: 'conferred' | 'not_found' | 'pending'
  ): Promise<void> {
    const userId = await getCurrentUserId();

    // Try updating banking transaction first
    const { error: transError } = await db
      .from('banking_transactions')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (!transError) return;

    // If not found in transactions, try cash conference
    const { error: confError } = await db
      .from('cash_conference')
      .update({
        conference_status: status === 'conferred' ? 'active' : 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (confError) {
      console.error('Error updating conference status:', confError);
      throw confError;
    }
  }

  // Delete history entry
  static async deleteHistoryEntry(id: string): Promise<void> {
    const userId = await getCurrentUserId();

    // Try deleting from banking transactions first
    const { error: transError } = await db
      .from('banking_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!transError) return;

    // Try cash conference
    const { error: confError } = await db
      .from('cash_conference')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (!confError) return;

    // Try not found history
    const { error: nfError } = await db
      .from('not_found_history')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (nfError) {
      console.error('Error deleting history entry:', nfError);
      throw nfError;
    }
  }

  // Clear day history
  static async clearDayHistory(date: string): Promise<void> {
    const userId = await getCurrentUserId();

    // Convert DD-MM-YYYY to YYYY-MM-DD for database
    const [day, month, year] = date.split('-');
    const dbDate = `${year}-${month}-${day}`;

    // Clear banking transactions
    await db
      .from('banking_transactions')
      .delete()
      .eq('user_id', userId)
      .eq('transaction_date', dbDate);

    // Clear cash conferences
    await db
      .from('cash_conference')
      .delete()
      .eq('user_id', userId)
      .eq('conference_date', dbDate);

    // Clear not found history for the day
    await db
      .from('not_found_history')
      .delete()
      .eq('user_id', userId)
      .gte('search_timestamp', `${dbDate}T00:00:00`)
      .lt('search_timestamp', `${dbDate}T23:59:59`);

    // Clear banking files
    await db
      .from('banking_files')
      .delete()
      .eq('user_id', userId)
      .eq('operation_date', dbDate);
  }
}