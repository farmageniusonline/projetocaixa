/**
 * Test data factories for generating consistent mock data
 * Enhanced factory pattern for consistent and flexible mock generation
 */

import type {
  User,
  Profile,
  BankingTransaction,
  CashConference,
  ParsedRow,
  BankEntryForProcessing
} from '../../types';

// Factory configuration interface
export interface FactoryConfig {
  sequenceStart?: number;
  useRealDates?: boolean;
  locale?: 'pt-BR' | 'en-US';
}

// Global factory configuration
let globalConfig: FactoryConfig = {
  sequenceStart: 1,
  useRealDates: true,
  locale: 'pt-BR'
};

export function configureFactories(config: Partial<FactoryConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

// Sequence counter for unique IDs
let sequenceCounter = globalConfig.sequenceStart || 1;

// Reset sequence for testing
export function resetSequence(start: number = 1): void {
  sequenceCounter = start;
}

// Get next sequence number
function nextSequence(): number {
  return sequenceCounter++;
}

// Enhanced ID generation with sequence support
export function generateId(prefix: string = 'test'): string {
  return `${prefix}-${nextSequence()}`;
}

// Generate UUID-like ID
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate sequential dates
export function generateDate(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Brazilian date format generator
export function generateBrazilianDate(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Profile factory
export function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: generateId(),
    username: 'testuser',
    full_name: 'Test User',
    role: 'user',
    is_active: true,
    ...overrides
  };
}

// User factory
export function createMockUser(overrides: Partial<User> = {}): User {
  const profile = createMockProfile();
  return {
    username: profile.username,
    id: profile.id,
    email: `${profile.username}@test.com`,
    profile,
    ...overrides
  };
}

// Banking transaction factory
export function createMockBankingTransaction(overrides: Partial<BankingTransaction> = {}): BankingTransaction {
  return {
    id: generateId(),
    transaction_date: generateBrazilianDate(),
    payment_type: 'PIX RECEBIDO',
    cpf: '12345678901',
    value: 100.50,
    original_history: 'PIX RECEBIDO DE TESTE',
    status: 'pending',
    is_transferred: false,
    ...overrides
  };
}

// Cash conference factory
export function createMockCashConference(overrides: Partial<CashConference> = {}): CashConference {
  return {
    id: generateId(),
    conferred_value: 100.50,
    conference_date: generateBrazilianDate(),
    transaction_date: generateBrazilianDate(),
    payment_type: 'DINHEIRO',
    cpf: '12345678901',
    original_value: 100.50,
    original_history: 'CONFERENCIA TESTE',
    ...overrides
  };
}

// Parsed row factory (Excel processing)
export function createMockParsedRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    date: generateBrazilianDate(),
    paymentType: 'PIX RECEBIDO',
    cpf: '12345678901',
    value: 100.50,
    originalHistory: 'PIX RECEBIDO DE TESTE',
    validationStatus: 'valid',
    ...overrides
  };
}

// Bank entry for processing factory
export function createMockBankEntry(overrides: Partial<BankEntryForProcessing> = {}): BankEntryForProcessing {
  return {
    id: Date.now(),
    source_id: generateId(),
    document_number: '12345678901',
    date: generateBrazilianDate(),
    description: 'TRANSACAO TESTE',
    value: 100.50,
    value_cents: 10050,
    transaction_type: 'PIX RECEBIDO',
    status: 'pending',
    day: generateBrazilianDate(),
    ...overrides
  };
}

// Batch factories for generating arrays
export function createMockBankingTransactions(count: number = 5): BankingTransaction[] {
  return Array.from({ length: count }, (_, index) =>
    createMockBankingTransaction({
      id: `${generateId()}-${index}`,
      value: (index + 1) * 50,
      transaction_date: generateBrazilianDate(index)
    })
  );
}

export function createMockCashConferences(count: number = 5): CashConference[] {
  return Array.from({ length: count }, (_, index) =>
    createMockCashConference({
      id: `${generateId()}-${index}`,
      conferred_value: (index + 1) * 50,
      conference_date: generateBrazilianDate(index)
    })
  );
}

export function createMockParsedRows(count: number = 5): ParsedRow[] {
  const paymentTypes = ['PIX RECEBIDO', 'CARTÃO', 'DINHEIRO', 'TED', 'DOC'];
  const statuses: ParsedRow['validationStatus'][] = ['valid', 'warning', 'error'];

  return Array.from({ length: count }, (_, index) =>
    createMockParsedRow({
      value: (index + 1) * 25,
      paymentType: paymentTypes[index % paymentTypes.length],
      validationStatus: statuses[index % statuses.length],
      date: generateBrazilianDate(index)
    })
  );
}

// Complex scenario factories
export function createMockExcelProcessingResult() {
  const parsedRows = createMockParsedRows(10);
  const validRows = parsedRows.filter(row => row.validationStatus === 'valid');
  const warningRows = parsedRows.filter(row => row.validationStatus === 'warning');
  const errorRows = parsedRows.filter(row => row.validationStatus === 'error');

  return {
    parseResult: {
      success: errorRows.length === 0,
      data: parsedRows,
      errors: errorRows.map((_, index) => `Erro na linha ${index + 1}`),
      warnings: warningRows.map((_, index) => `Aviso na linha ${index + 1}`),
      stats: {
        totalRows: parsedRows.length,
        validRows: validRows.length,
        rowsWithWarnings: warningRows.length,
        rowsWithErrors: errorRows.length,
        totalValue: parsedRows.reduce((sum, row) => sum + row.value, 0)
      }
    },
    valueCentsMap: new Map(),
    normalizedEntries: parsedRows.map((row, index) => createMockBankEntry({
      id: index,
      value: row.value,
      description: row.originalHistory
    }))
  };
}

// API response factories
export function createMockApiResponse<T>(data: T, success: boolean = true) {
  return {
    data: success ? data : null,
    error: success ? null : 'Mock error message',
    success
  };
}

export function createMockPaginatedResponse<T>(data: T[], page: number = 1, limit: number = 10) {
  return {
    data,
    error: null,
    success: true,
    pagination: {
      page,
      limit,
      total: data.length * 3, // Simulate more total items
      totalPages: Math.ceil((data.length * 3) / limit)
    }
  };
}

// Error scenario factories
export function createMockValidationError(field: string, value: unknown) {
  return {
    code: 'VALIDATION_ERROR',
    message: `Invalid ${field}`,
    details: { field, value },
    timestamp: new Date()
  };
}

export function createMockDatabaseError(operation: string) {
  return {
    code: 'DATABASE_ERROR',
    message: `Failed to ${operation}`,
    details: { operation, table: 'test_table' },
    timestamp: new Date()
  };
}

// File mock factories
export function createMockFile(name: string = 'test.xlsx', size: number = 1024): File {
  const content = new ArrayBuffer(size);
  return new File([content], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    *[Symbol.iterator]() {
      for (const file of files) {
        yield file;
      }
    }
  };
  return fileList as FileList;
}

// Date range factories
export function createMockDateRange(daysSpan: number = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysSpan);

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

// Search result factories
export function createMockSearchResult<T>(items: T[], query: string) {
  return {
    exact: items.slice(0, 2),
    approximate: items.slice(2, 4),
    fuzzy: items.slice(4),
    total: items.length
  };
}

// Performance test data factory
export function createLargeDataset(size: number = 1000): BankingTransaction[] {
  const paymentTypes = ['PIX RECEBIDO', 'PIX ENVIADO', 'CARTÃO', 'DINHEIRO', 'TED', 'DOC'];
  const statuses = ['pending', 'conferred', 'not_found', 'archived'];

  return Array.from({ length: size }, (_, index) => ({
    id: `perf-test-${index}`,
    transaction_date: generateBrazilianDate(index % 30),
    payment_type: paymentTypes[index % paymentTypes.length],
    cpf: `${String(index).padStart(11, '0')}`,
    value: Math.round((Math.random() * 1000 + 10) * 100) / 100,
    original_history: `TRANSACAO AUTOMATICA ${index}`,
    status: statuses[index % statuses.length] as BankingTransaction['status'],
    is_transferred: Math.random() > 0.5
  }));
}