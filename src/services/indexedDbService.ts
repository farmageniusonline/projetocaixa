import toast from 'react-hot-toast';
import {
  db,
  BankEntry,
  CashConferenceEntry,
  NotFoundHistoryEntry,
  ManualEntry,
  DaySelection,
  ActionLog
} from '../lib/indexeddb';
import { dbLogger as logger } from '../utils/logger';
import { generateManualId, generateOriginHashSync, generateConferenceId } from '../utils/idGenerator';
import { formatToDDMMYYYY } from '../utils/dateFormatter';
import { formSchemas, safeValidate } from '../utils/validationSchemas';
import { performanceLogger } from '../utils/performanceLogger';

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
  operation_date: string;
  banking_total_uploaded: number;
  banking_total_value: number;
  banking_conferred_count: number;
  banking_conferred_value: number;
  cash_conferred_count: number;
  cash_conferred_value: number;
  cash_not_found_count: number;
  manual_entries_count: number;
  manual_entries_value: number;
  last_file_name?: string;
  last_upload_timestamp?: string;
  total_conferred?: number;
  total_value?: number;
}

export class IndexedDbService {
  private static currentUserId: string = 'default_user'; // Será configurado pelo AuthContext

  static setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  static getCurrentUserId(): string {
    return this.currentUserId;
  }

  // Conversão de valor para centavos
  private static valueToCents(value: number): number {
    return Math.round(value * 100);
  }

  // Conversão de centavos para valor
  private static centsToValue(cents: number): number {
    return cents / 100;
  }

  // === SISTEMA DE LOG DE AÇÕES ===

  static async logAction(
    actionType: ActionLog['action_type'],
    description: string,
    operationDate: string,
    payload: ActionLog['payload'],
    result: ActionLog['result'] = 'success',
    errorMessage?: string
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      const logEntry: ActionLog = {
        action_type: actionType,
        action_description: description,
        user_id: userId,
        day: operationDate,
        payload,
        result,
        error_message: errorMessage,
        metadata: {
          user_agent: navigator.userAgent,
          timestamp_local: new Date().toLocaleString('pt-BR')
        }
      };

      await db.action_log.add(logEntry);
    } catch (error) {
      logger.error('Error logging action:', error);
      // Don't throw error here to avoid breaking the main operation
    }
  }

  // === OPERAÇÕES DE UPLOAD BANCÁRIO ===

  static async saveBankingUpload(
    data: any[],
    fileName: string,
    operationDate: string,
    uploadMode: 'automatic' | 'manual'
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      await db.transaction('rw', db.bank_uploads, db.bank_entries, async () => {
        // Criar upload
        const uploadId = await db.bank_uploads.add({
          day: operationDate,
          bank_name: data[0]?.bankName,
          account_number: data[0]?.accountNumber,
          file_name: fileName,
          file_upload_date: operationDate,
          upload_mode: uploadMode,
          user_id: userId,
          metadata: { total_entries: data.length }
        });

        // Criar entradas bancárias com origin_hash
        const entries: BankEntry[] = data.map(item => {
          const originHash = generateOriginHashSync(
            item.date || operationDate,
            item.documentNumber || '',
            item.value || 0,
            item.description || ''
          );

          return {
            upload_id: uploadId as number,
            source_id: originHash,
            day: operationDate,
            document_number: item.documentNumber,
            date: item.date,
            description: item.description,
            value: item.value,
            value_cents: this.valueToCents(item.value || 0),
            transaction_type: item.transactionType,
            balance: item.balance,
            status: 'pending',
            source: 'banking_upload',
            user_id: userId,
            metadata: item
          };
        });

        // Check for duplicates by source_id before adding
        const duplicateChecks = await Promise.all(
          entries.map(entry => db.bank_entries.where('source_id').equals(entry.source_id!).first())
        );

        const duplicates = duplicateChecks.filter(Boolean);
        if (duplicates.length > 0) {
          throw new Error(`${duplicates.length} entradas duplicadas encontradas. Upload cancelado.`);
        }

        await db.bank_entries.bulkAdd(entries);

        // Log da ação
        await this.logAction(
          'banking_upload',
          `Upload de ${entries.length} entradas bancárias do arquivo ${fileName}`,
          operationDate,
          {
            file_name: fileName,
            entry_count: entries.length,
            source_ids: entries.map(e => e.source_id!),
            values: entries.map(e => e.value || 0),
            upload_mode: uploadMode
          }
        );
      });
    } catch (error) {
      logger.error('Error saving banking upload:', error);

      // Log da ação com erro
      await this.logAction(
        'banking_upload',
        `Falha no upload do arquivo ${fileName}`,
        operationDate,
        {
          file_name: fileName,
          entry_count: data.length,
          upload_mode: uploadMode
        },
        'error',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );

      if (error instanceof Error && error.message.includes('duplicadas')) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao salvar upload bancário. Tente novamente.');
      }
      throw error;
    }
  }

  // === OPERAÇÕES DE CONFERÊNCIA DE CAIXA ===

  static async saveCashConference(
    item: any,
    operationDate: string,
    status: 'conferred' | 'not_found'
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      // Use origin_hash if available, otherwise generate conference_id
      const sourceId = item.source_id || generateConferenceId();

      const entry: CashConferenceEntry = {
        source_id: sourceId,
        day: operationDate,
        document_number: item.documentNumber,
        description: item.description,
        value: item.value,
        value_cents: this.valueToCents(item.value || 0),
        status: status,
        conferred_at: new Date().toISOString(),
        conferred_by: userId,
        source: 'cash_conference',
        user_id: userId,
        metadata: item
      };

      // Check for duplicate by source_id
      const existingEntry = await db.cash_conference_entries.where('source_id').equals(sourceId).first();
      if (existingEntry) {
        throw new Error('Entrada já foi conferida anteriormente.');
      }

      await db.cash_conference_entries.add(entry);

      // Log da ação
      await this.logAction(
        'cash_conference',
        `Conferência de caixa: ${status === 'conferred' ? 'Conferido' : 'Não encontrado'} - ${entry.description}`,
        operationDate,
        {
          source_ids: [sourceId],
          values: [item.value || 0],
          target_status: status
        }
      );
    } catch (error) {
      logger.error('Error saving cash conference:', error);

      // Log da ação com erro
      await this.logAction(
        'cash_conference',
        `Falha na conferência de caixa: ${item.description}`,
        operationDate,
        {
          values: [item.value || 0],
          target_status: status
        },
        'error',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );

      if (error instanceof Error && error.message.includes('já foi conferida')) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao salvar conferência. Tente novamente.');
      }
      throw error;
    }
  }

  // === OPERAÇÕES DE VALORES NÃO ENCONTRADOS ===

  static async saveNotFound(
    value: string,
    operationDate: string
  ): Promise<void> {
    const userId = this.getCurrentUserId();
    const numericValue = parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));

    try {
      const entry: NotFoundHistoryEntry = {
        day: operationDate,
        value: isNaN(numericValue) ? 0 : numericValue,
        value_cents: this.valueToCents(isNaN(numericValue) ? 0 : numericValue),
        status: 'not_found',
        source: 'not_found_manual',
        user_id: userId,
        metadata: { originalValue: value }
      };

      await db.not_found_history.add(entry);

      // Log da ação
      await this.logAction(
        'not_found',
        `Valor não encontrado registrado: ${value}`,
        operationDate,
        {
          values: [numericValue],
          original_value: value
        }
      );
    } catch (error) {
      logger.error('Error saving not found value:', error);

      // Log da ação com erro
      await this.logAction(
        'not_found',
        `Falha ao registrar valor não encontrado: ${value}`,
        operationDate,
        {
          original_value: value
        },
        'error',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );

      throw error;
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
    const saveOpId = performanceLogger.startOperation('manual_entry_save', {
      entryType: entry.entry_type,
      value: entry.value,
      operationDate
    });

    const userId = this.getCurrentUserId();

    try {
      // Validate entry data using Zod schema
      const validation = safeValidate(formSchemas.manualEntry, entry);
      if (!validation.success) {
        throw new Error(`Dados inválidos: ${validation.error}`);
      }

      const validatedEntry = validation.data;

      const manualEntry: ManualEntry = {
        source_id: generateManualId(),
        day: operationDate,
        document_number: validatedEntry.document_number,
        description: validatedEntry.description,
        value: validatedEntry.value,
        value_cents: this.valueToCents(validatedEntry.value),
        entry_type: validatedEntry.entry_type,
        category: validatedEntry.category,
        status: 'active',
        source: 'manual_entry',
        user_id: userId,
        metadata: validatedEntry
      };

      // Check for duplicate by source_id
      const existingEntry = await db.manual_entries.where('source_id').equals(manualEntry.source_id).first();
      if (existingEntry) {
        throw new Error('Lançamento manual já existe.');
      }

      await db.manual_entries.add(manualEntry);

      // Log da ação
      await this.logAction(
        'manual_entry',
        `Lançamento manual criado: ${validatedEntry.entry_type} - ${validatedEntry.description}`,
        operationDate,
        {
          source_ids: [manualEntry.source_id],
          values: [validatedEntry.value],
          entry_type: validatedEntry.entry_type,
          category: validatedEntry.category
        }
      );

      performanceLogger.endOperation(saveOpId);
    } catch (error) {
      performanceLogger.endOperation(saveOpId);
      logger.error('Error saving manual entry:', error);

      // Log da ação com erro
      await this.logAction(
        'manual_entry',
        `Falha ao criar lançamento manual: ${entry.description || 'Sem descrição'}`,
        operationDate,
        {
          values: [entry.value || 0],
          entry_type: entry.entry_type
        },
        'error',
        error instanceof Error ? error.message : 'Erro desconhecido'
      );

      if (error instanceof Error && error.message.includes('já existe')) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao salvar lançamento manual. Tente novamente.');
      }
      throw error;
    }
  }

  // === OPERAÇÕES DE CONSULTA ===

  static async getHistoryByDate(date: string): Promise<ConferenceHistoryEntry[]> {
    const userId = this.getCurrentUserId();

    try {
      const [bankEntries, cashEntries, notFoundEntries, manualEntries] = await Promise.all([
        db.bank_entries.where({ day: date, user_id: userId }).toArray(),
        db.cash_conference_entries.where({ day: date, user_id: userId }).toArray(),
        db.not_found_history.where({ day: date, user_id: userId }).toArray(),
        db.manual_entries.where({ day: date, user_id: userId }).toArray()
      ]);

      // Converter para formato unificado
      const history: ConferenceHistoryEntry[] = [];

      // Entradas bancárias
      for (const entry of bankEntries) {
        const upload = await db.bank_uploads.get(entry.upload_id);
        history.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'banking_upload',
          operation_timestamp: entry.created_at,
          document_number: entry.document_number,
          date: entry.date,
          description: entry.description,
          value: entry.value,
          bank_name: upload?.bank_name,
          account_number: upload?.account_number,
          transaction_type: entry.transaction_type,
          balance: entry.balance,
          conferred_at: entry.conferred_at,
          conferred_by: entry.conferred_by,
          status: entry.status,
          file_name: upload?.file_name,
          file_upload_date: upload?.file_upload_date,
          upload_mode: upload?.upload_mode,
          metadata: entry.metadata,
          user_id: entry.user_id,
          source: entry.source
        });
      }

      // Entradas de conferência de caixa
      for (const entry of cashEntries) {
        history.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'cash_conference',
          operation_timestamp: entry.created_at,
          document_number: entry.document_number,
          description: entry.description,
          value: entry.value,
          conferred_at: entry.conferred_at,
          conferred_by: entry.conferred_by,
          status: entry.status,
          metadata: entry.metadata,
          user_id: entry.user_id,
          source: entry.source
        });
      }

      // Entradas não encontradas
      for (const entry of notFoundEntries) {
        history.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'not_found',
          operation_timestamp: entry.created_at,
          value: entry.value,
          status: entry.status,
          metadata: entry.metadata,
          user_id: entry.user_id,
          source: entry.source
        });
      }

      // Entradas manuais
      for (const entry of manualEntries) {
        history.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'manual_entry',
          operation_timestamp: entry.created_at,
          document_number: entry.document_number,
          description: entry.description,
          value: entry.value,
          status: entry.status,
          metadata: entry.metadata,
          user_id: entry.user_id,
          source: entry.source
        });
      }

      // Ordenar por timestamp (mais recente primeiro)
      return history.sort((a, b) => {
        const timeA = new Date(a.operation_timestamp || '').getTime();
        const timeB = new Date(b.operation_timestamp || '').getTime();
        return timeB - timeA;
      });
    } catch (error) {
      logger.error('Error fetching history:', error);
      throw error;
    }
  }

  static async getDailySummary(date: string): Promise<DailyOperationsSummary | null> {
    const userId = this.getCurrentUserId();

    try {
      const [bankEntries, cashEntries, notFoundEntries, manualEntries, uploads] = await Promise.all([
        db.bank_entries.where({ day: date, user_id: userId }).toArray(),
        db.cash_conference_entries.where({ day: date, user_id: userId }).toArray(),
        db.not_found_history.where({ day: date, user_id: userId }).toArray(),
        db.manual_entries.where({ day: date, user_id: userId }).toArray(),
        db.bank_uploads.where({ day: date, user_id: userId }).toArray()
      ]);

      if (bankEntries.length === 0 && cashEntries.length === 0 &&
          notFoundEntries.length === 0 && manualEntries.length === 0) {
        return null;
      }

      // Calcular estatísticas bancárias
      const bankingConferred = bankEntries.filter(e => e.status === 'conferred');
      const bankingTotalValue = bankEntries.reduce((sum, e) => sum + (e.value || 0), 0);
      const bankingConferredValue = bankingConferred.reduce((sum, e) => sum + (e.value || 0), 0);

      // Calcular estatísticas de caixa
      const cashConferred = cashEntries.filter(e => e.status === 'conferred');
      const cashNotFound = cashEntries.filter(e => e.status === 'not_found');
      const cashConferredValue = cashConferred.reduce((sum, e) => sum + (e.value || 0), 0);

      // Calcular estatísticas de lançamentos manuais
      const activeManualEntries = manualEntries.filter(e => e.status === 'active');
      const manualEntriesValue = activeManualEntries.reduce((sum, e) => sum + (e.value || 0), 0);

      // Último upload
      const lastUpload = uploads.sort((a, b) =>
        new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      )[0];

      return {
        operation_date: date,
        banking_total_uploaded: bankEntries.length,
        banking_total_value: bankingTotalValue,
        banking_conferred_count: bankingConferred.length,
        banking_conferred_value: bankingConferredValue,
        cash_conferred_count: cashConferred.length,
        cash_conferred_value: cashConferredValue,
        cash_not_found_count: cashNotFound.length + notFoundEntries.length,
        manual_entries_count: activeManualEntries.length,
        manual_entries_value: manualEntriesValue,
        last_file_name: lastUpload?.file_name,
        last_upload_timestamp: lastUpload?.created_at,
        total_conferred: bankingConferred.length + cashConferred.length,
        total_value: bankingTotalValue + cashConferredValue + manualEntriesValue
      };
    } catch (error) {
      logger.error('Error calculating daily summary:', error);
      throw error;
    }
  }

  // === OPERAÇÕES DE TRANSAÇÃO ===

  static async transferBankingToCash(
    bankEntryId: number,
    operationDate: string
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      await db.transaction('rw', db.bank_entries, db.cash_conference_entries, async () => {
        // Buscar a entrada bancária
        const bankEntry = await db.bank_entries.where({ id: bankEntryId, user_id: userId }).first();

        if (!bankEntry) {
          throw new Error('Entrada bancária não encontrada');
        }

        if (bankEntry.status === 'transferred') {
          throw new Error('Entrada já foi transferida');
        }

        // Criar entrada no caixa usando o mesmo source_id
        const cashEntry: CashConferenceEntry = {
          source_id: bankEntry.source_id!,
          day: operationDate,
          document_number: bankEntry.document_number,
          description: bankEntry.description,
          value: bankEntry.value,
          value_cents: bankEntry.value_cents,
          status: 'conferred',
          conferred_at: new Date().toISOString(),
          conferred_by: userId,
          source: 'cash_conference',
          user_id: userId,
          metadata: {
            ...bankEntry.metadata,
            transferred_from_bank_entry: bankEntryId,
            original_bank_date: bankEntry.date
          }
        };

        await db.cash_conference_entries.add(cashEntry);

        // Marcar entrada bancária como transferida
        await db.bank_entries.where({ id: bankEntryId, user_id: userId }).modify({
          status: 'transferred',
          conferred_at: new Date().toISOString(),
          conferred_by: userId
        });

        // Log da ação
        await this.logAction(
          'transfer',
          `Transferência bancária→caixa: ${bankEntry.description}`,
          operationDate,
          {
            source_ids: [bankEntry.source_id!],
            values: [bankEntry.value || 0],
            original_status: bankEntry.status,
            target_status: 'transferred'
          }
        );
      });
    } catch (error) {
      logger.error('Error transferring banking to cash:', error);
      const errorMessage = `Falha na transferência: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;

      // Log da ação com erro
      await this.logAction(
        'transfer',
        `Falha na transferência bancária→caixa (ID: ${bankEntryId})`,
        operationDate,
        {
          bank_entry_id: bankEntryId
        },
        'error',
        errorMessage
      );

      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  static async undoManualEntry(
    sourceId: string
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      await db.transaction('rw', db.manual_entries, db.cash_conference_entries, async () => {
        // Buscar a entrada manual por source_id
        const manualEntry = await db.manual_entries.where({ source_id: sourceId, user_id: userId }).first();

        if (!manualEntry) {
          throw new Error('Lançamento manual não encontrado');
        }

        if (manualEntry.status === 'cancelled') {
          throw new Error('Lançamento já foi cancelado');
        }

        // Remover entrada no caixa que tem o mesmo source_id
        await db.cash_conference_entries
          .where('source_id').equals(sourceId)
          .and(entry => entry.user_id === userId)
          .delete();

        // Remover a entrada manual por source_id
        await db.manual_entries.where({ source_id: sourceId, user_id: userId }).delete();

        // Log da ação
        await this.logAction(
          'undo',
          `Lançamento manual desfeito: ${manualEntry.description}`,
          manualEntry.day,
          {
            source_ids: [sourceId],
            values: [manualEntry.value || 0],
            original_status: manualEntry.status,
            entry_type: manualEntry.entry_type
          }
        );
      });
    } catch (error) {
      logger.error('Error undoing manual entry:', error);
      const errorMessage = `Falha ao desfazer lançamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;

      // Log da ação com erro
      await this.logAction(
        'undo',
        `Falha ao desfazer lançamento manual com source_id: ${sourceId}`,
        formatToDDMMYYYY(new Date()),
        {
          source_ids: [sourceId]
        },
        'error',
        errorMessage
      );

      toast.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // === OPERAÇÕES DE ATUALIZAÇÃO ===

  static async updateConferenceStatus(
    id: string | number,
    status: 'conferred' | 'not_found' | 'pending' | 'transferred',
    source: 'banking_upload' | 'cash_conference' | 'not_found_manual' | 'manual_entry'
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'conferred' || status === 'transferred') {
        updateData.conferred_at = new Date().toISOString();
        updateData.conferred_by = userId;
      } else {
        updateData.conferred_at = null;
        updateData.conferred_by = null;
      }

      switch (source) {
        case 'banking_upload':
          await db.bank_entries.where({ id: Number(id), user_id: userId }).modify(updateData);
          break;
        case 'cash_conference':
          await db.cash_conference_entries.where({ id: Number(id), user_id: userId }).modify(updateData);
          break;
        case 'not_found_manual':
          await db.not_found_history.where({ id: Number(id), user_id: userId }).modify(updateData);
          break;
        case 'manual_entry':
          await db.manual_entries.where({ id: Number(id), user_id: userId }).modify(updateData);
          break;
      }
    } catch (error) {
      logger.error('Error updating conference status:', error);
      throw error;
    }
  }

  // === OPERAÇÕES DE SELEÇÃO DE DATA ===

  static async saveDaySelection(day: string, selectedDate: string): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      await db.day_selection.put({
        day,
        selected_date: selectedDate,
        user_id: userId,
        last_accessed: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error saving day selection:', error);
      throw error;
    }
  }

  static async getDaySelection(day: string): Promise<DaySelection | null> {
    const userId = this.getCurrentUserId();

    try {
      const selection = await db.day_selection.where({ day, user_id: userId }).first();
      return selection || null;
    } catch (error) {
      logger.error('Error getting day selection:', error);
      return null;
    }
  }

  // === OPERAÇÕES DE LIMPEZA ===

  static async clearDayHistory(date: string): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      await db.transaction('rw',
        [db.bank_uploads, db.bank_entries, db.cash_conference_entries, db.not_found_history, db.manual_entries],
        async () => {
        // Obter IDs dos uploads para deletar entries relacionadas
        const uploads = await db.bank_uploads.where({ day: date, user_id: userId }).toArray();
        const uploadIds = uploads.map(u => u.id!);

        // Deletar entries bancárias
        for (const uploadId of uploadIds) {
          await db.bank_entries.where('upload_id').equals(uploadId).delete();
        }

        // Deletar uploads
        await db.bank_uploads.where({ day: date, user_id: userId }).delete();

        // Deletar outros tipos de entrada
        await db.cash_conference_entries.where({ day: date, user_id: userId }).delete();
        await db.not_found_history.where({ day: date, user_id: userId }).delete();
        await db.manual_entries.where({ day: date, user_id: userId }).delete();
      });
    } catch (error) {
      logger.error('Error clearing day history:', error);
      throw error;
    }
  }

  static async deleteHistoryEntry(
    id: string | number,
    source: 'banking_upload' | 'cash_conference' | 'not_found_manual' | 'manual_entry'
  ): Promise<void> {
    const userId = this.getCurrentUserId();

    try {
      switch (source) {
        case 'banking_upload':
          const entry = await db.bank_entries.where({ id: Number(id), user_id: userId }).first();
          if (entry) {
            await db.bank_entries.delete(Number(id));
            // Verificar se é a última entrada do upload
            const remainingEntries = await db.bank_entries.where('upload_id').equals(entry.upload_id).count();
            if (remainingEntries === 0) {
              await db.bank_uploads.delete(entry.upload_id);
            }
          }
          break;
        case 'cash_conference':
          await db.cash_conference_entries.where({ id: Number(id), user_id: userId }).delete();
          break;
        case 'not_found_manual':
          await db.not_found_history.where({ id: Number(id), user_id: userId }).delete();
          break;
        case 'manual_entry':
          await db.manual_entries.where({ id: Number(id), user_id: userId }).delete();
          break;
      }
    } catch (error) {
      logger.error('Error deleting history entry:', error);
      throw error;
    }
  }

  // === OPERAÇÕES DE BUSCA ===

  static async searchByValue(value: number, date?: string): Promise<ConferenceHistoryEntry[]> {
    const userId = this.getCurrentUserId();
    const valueCents = this.valueToCents(value);

    try {
      let bankQuery = db.bank_entries.where({ value_cents: valueCents, user_id: userId });
      let cashQuery = db.cash_conference_entries.where({ value_cents: valueCents, user_id: userId });
      let notFoundQuery = db.not_found_history.where({ value_cents: valueCents, user_id: userId });
      let manualQuery = db.manual_entries.where({ value_cents: valueCents, user_id: userId });

      if (date) {
        bankQuery = bankQuery.and(item => item.day === date);
        cashQuery = cashQuery.and(item => item.day === date);
        notFoundQuery = notFoundQuery.and(item => item.day === date);
        manualQuery = manualQuery.and(item => item.day === date);
      }

      const [bankEntries, cashEntries, notFoundEntries, manualEntries] = await Promise.all([
        bankQuery.toArray(),
        cashQuery.toArray(),
        notFoundQuery.toArray(),
        manualQuery.toArray()
      ]);

      // Converter para formato unificado (similar ao getHistoryByDate)
      const results: ConferenceHistoryEntry[] = [];

      for (const entry of bankEntries) {
        const upload = await db.bank_uploads.get(entry.upload_id);
        results.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'banking_upload',
          operation_timestamp: entry.created_at,
          document_number: entry.document_number,
          description: entry.description,
          value: entry.value,
          status: entry.status,
          source: entry.source,
          file_name: upload?.file_name,
          user_id: entry.user_id
        });
      }

      for (const entry of cashEntries) {
        results.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'cash_conference',
          operation_timestamp: entry.created_at,
          document_number: entry.document_number,
          description: entry.description,
          value: entry.value,
          status: entry.status,
          source: entry.source,
          user_id: entry.user_id
        });
      }

      for (const entry of notFoundEntries) {
        results.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'not_found',
          operation_timestamp: entry.created_at,
          value: entry.value,
          status: entry.status,
          source: entry.source,
          user_id: entry.user_id
        });
      }

      for (const entry of manualEntries) {
        results.push({
          id: entry.id,
          operation_date: entry.day,
          operation_type: 'manual_entry',
          operation_timestamp: entry.created_at,
          document_number: entry.document_number,
          description: entry.description,
          value: entry.value,
          status: entry.status,
          source: entry.source,
          user_id: entry.user_id
        });
      }

      return results.sort((a, b) =>
        new Date(b.operation_timestamp || '').getTime() - new Date(a.operation_timestamp || '').getTime()
      );
    } catch (error) {
      logger.error('Error searching by value:', error);
      throw error;
    }
  }

  // === ESTATÍSTICAS ===

  static async getStats(): Promise<{
    bank_uploads: number;
    bank_entries: number;
    cash_conference_entries: number;
    not_found_history: number;
    manual_entries: number;
    day_selection: number;
    total_storage_mb: number;
  }> {
    try {
      const stats = await db.getStats();

      // Estimar uso de storage (aproximado)
      const estimation = (stats.bank_uploads * 0.5) +
                        (stats.bank_entries * 1) +
                        (stats.cash_conference_entries * 0.8) +
                        (stats.not_found_history * 0.3) +
                        (stats.manual_entries * 0.8) +
                        (stats.day_selection * 0.2);

      return {
        ...stats,
        total_storage_mb: Math.round(estimation / 1000) / 1000 // KB para MB
      };
    } catch (error) {
      logger.error('Error getting stats:', error);
      throw error;
    }
  }
}

export default IndexedDbService;