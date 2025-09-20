import { db, BankUpload, BankEntry } from './indexeddb';
import toast from 'react-hot-toast';

export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: 'ConstraintError' | 'VersionError' | 'DatabaseError' | 'UnknownError';
}

export interface BankingUploadData {
  entries: Omit<BankEntry, 'id' | 'upload_id'>[];
  fileName: string;
  operationDate: string;
  uploadMode: 'automatic' | 'manual';
  userId?: string;
}

/**
 * Executes a banking upload transaction safely with proper error handling
 */
export async function executeBankingUploadTransaction(
  data: BankingUploadData
): Promise<TransactionResult<{ uploadId: number; entryIds: number[] }>> {
  const startTime = Date.now();
  console.log('🏦 Iniciando transação de upload bancário...', {
    entries: data.entries.length,
    fileName: data.fileName,
    operationDate: data.operationDate
  });

  try {
    // Validate required data
    if (!data.entries || data.entries.length === 0) {
      throw new Error('Nenhuma entrada fornecida para salvar');
    }

    if (!data.fileName || !data.operationDate) {
      throw new Error('Dados obrigatórios ausentes (fileName ou operationDate)');
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: Transação do banco excedeu 60 segundos'));
      }, 60000); // 60 second timeout
    });

    // Execute transaction with timeout
    const transactionPromise = db.transaction(
      'rw',
      [db.bank_uploads, db.bank_entries],
      async (transaction) => {
        console.log('📝 Executando transação...');

        // 1. Create bank upload record
        const uploadRecord: Omit<BankUpload, 'id'> = {
          day: data.operationDate,
          file_name: data.fileName,
          file_upload_date: new Date().toISOString(),
          upload_mode: data.uploadMode,
          user_id: data.userId || 'default_user',
          metadata: {
            totalEntries: data.entries.length,
            uploadTimestamp: Date.now()
          }
        };

        const uploadId = await transaction.table('bank_uploads').add(uploadRecord);
        console.log(`✅ Upload record criado com ID: ${uploadId}`);

        // 2. Prepare bank entries with upload_id
        const entriesWithUploadId: Omit<BankEntry, 'id'>[] = data.entries.map(entry => ({
          ...entry,
          upload_id: Number(uploadId),
          user_id: data.userId || 'default_user',
          source: 'banking_upload' as const
        }));

        // 3. Bulk insert bank entries
        console.log('💾 Inserindo entradas em lote...');
        const entryIds = await transaction.table('bank_entries').bulkAdd(
          entriesWithUploadId,
          { allKeys: true }
        );

        console.log(`✅ ${entryIds.length} entradas inseridas com sucesso`);

        return {
          uploadId: Number(uploadId),
          entryIds: entryIds.map(id => Number(id))
        };
      }
    );

    // Race between transaction and timeout
    const result = await Promise.race([transactionPromise, timeoutPromise]);

    const elapsed = Date.now() - startTime;
    console.log(`🎉 Transação bancária concluída em ${elapsed}ms`);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Erro na transação bancária após ${elapsed}ms:`, error);

    // Categorize the error for better user feedback
    let errorType: TransactionResult['errorType'] = 'UnknownError';
    let userMessage = 'Erro desconhecido ao salvar no banco de dados';

    if (error instanceof Error) {
      const errorName = error.name;
      const errorMessage = error.message.toLowerCase();

      if (errorName === 'ConstraintError' || errorMessage.includes('constraint')) {
        errorType = 'ConstraintError';
        userMessage = 'Dados duplicados ou inválidos detectados';
      } else if (errorName === 'VersionError' || errorMessage.includes('version')) {
        errorType = 'VersionError';
        userMessage = 'Banco de dados desatualizado. Recarregue a página.';
      } else if (errorMessage.includes('database') || errorMessage.includes('indexeddb')) {
        errorType = 'DatabaseError';
        userMessage = 'Erro de acesso ao banco de dados local';
      } else {
        userMessage = error.message;
      }
    }

    return {
      success: false,
      error: userMessage,
      errorType
    };
  }
}

/**
 * Executes a cash conference transaction safely
 */
export async function executeCashConferenceTransaction(
  entries: Array<{
    source_id: string;
    day: string;
    document_number?: string;
    description?: string;
    value: number;
    status: 'conferred' | 'not_found';
    conferred_at?: string;
    conferred_by?: string;
    metadata?: any;
  }>,
  userId: string = 'default_user'
): Promise<TransactionResult<number[]>> {
  const startTime = Date.now();
  console.log('💰 Iniciando transação de conferência de caixa...', {
    entries: entries.length
  });

  try {
    if (!entries || entries.length === 0) {
      throw new Error('Nenhuma entrada de conferência fornecida');
    }

    const result = await db.transaction(
      'rw',
      [db.cash_conference_entries],
      async (transaction) => {
        console.log('📝 Executando transação de conferência...');

        // Prepare entries with required fields
        const conferenceEntries = entries.map(entry => ({
          ...entry,
          value_cents: Math.round(entry.value * 100),
          source: 'cash_conference' as const,
          user_id: userId,
          conferred_at: entry.conferred_at || new Date().toISOString()
        }));

        // Bulk insert conference entries
        const entryIds = await transaction.table('cash_conference_entries').bulkAdd(
          conferenceEntries,
          { allKeys: true }
        );

        console.log(`✅ ${entryIds.length} conferências inseridas com sucesso`);

        return entryIds.map(id => Number(id));
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`🎉 Transação de conferência concluída em ${elapsed}ms`);

    return {
      success: true,
      data: result
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Erro na transação de conferência após ${elapsed}ms:`, error);

    let errorType: TransactionResult['errorType'] = 'UnknownError';
    let userMessage = 'Erro ao salvar conferência de caixa';

    if (error instanceof Error) {
      const errorName = error.name;
      const errorMessage = error.message.toLowerCase();

      if (errorName === 'ConstraintError' || errorMessage.includes('constraint')) {
        errorType = 'ConstraintError';
        userMessage = 'Conferência já existe ou dados inválidos';
      } else if (errorName === 'VersionError') {
        errorType = 'VersionError';
        userMessage = 'Banco de dados desatualizado. Recarregue a página.';
      } else {
        userMessage = error.message;
      }
    }

    return {
      success: false,
      error: userMessage,
      errorType
    };
  }
}

/**
 * General purpose transaction wrapper with timeout and retry logic
 */
export async function executeTransaction<T>(
  transactionFn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    retries?: number;
    description?: string;
  } = {}
): Promise<TransactionResult<T>> {
  const { timeoutMs = 30000, retries = 2, description = 'Transaction' } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`🔄 Tentativa ${attempt + 1} de ${retries + 1} para: ${description}`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }

    try {
      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout de ${timeoutMs}ms excedido para: ${description}`));
        }, timeoutMs);
      });

      const result = await Promise.race([
        transactionFn(),
        timeoutPromise
      ]);

      console.log(`✅ ${description} executada com sucesso na tentativa ${attempt + 1}`);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Tentativa ${attempt + 1} falhou para ${description}:`, lastError.message);

      // Don't retry on certain errors
      if (lastError.name === 'VersionError' || lastError.message.includes('version')) {
        break; // Don't retry version errors
      }
    }
  }

  // All attempts failed
  console.error(`❌ Todas as tentativas falharam para: ${description}`, lastError);

  let errorType: TransactionResult['errorType'] = 'UnknownError';
  if (lastError?.name === 'ConstraintError') errorType = 'ConstraintError';
  else if (lastError?.name === 'VersionError') errorType = 'VersionError';
  else if (lastError?.message.includes('database')) errorType = 'DatabaseError';

  return {
    success: false,
    error: lastError?.message || 'Erro desconhecido na transação',
    errorType
  };
}

/**
 * Show user-friendly error toast based on transaction result
 */
export function handleTransactionError(result: TransactionResult, context: string = '') {
  if (result.success) return;

  const prefix = context ? `${context}: ` : '';

  switch (result.errorType) {
    case 'ConstraintError':
      toast.error(`${prefix}Dados duplicados ou inválidos detectados`);
      break;
    case 'VersionError':
      toast.error(`${prefix}Banco desatualizado. Recarregue a página.`);
      break;
    case 'DatabaseError':
      toast.error(`${prefix}Erro de acesso ao banco local`);
      break;
    default:
      toast.error(`${prefix}${result.error || 'Erro desconhecido'}`);
  }
}