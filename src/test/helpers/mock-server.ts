/**
 * Mock server utilities for consistent API mocking
 */

import { BatchFactory, createUser, createBankingTransaction, createCashConference } from '../factories/advanced-factories';
import type { User, BankingTransaction, CashConference } from '../../types';

// Mock response types
export interface MockResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  total?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Mock server state
class MockServerState {
  private users: User[] = [];
  private bankingTransactions: BankingTransaction[] = [];
  private cashConferences: CashConference[] = [];
  private currentUser: User | null = null;

  reset(): void {
    this.users = [];
    this.bankingTransactions = [];
    this.cashConferences = [];
    this.currentUser = null;
  }

  // User management
  addUser(user: User): void {
    this.users.push(user);
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getUsers(): User[] {
    return this.users;
  }

  // Banking transactions
  addBankingTransaction(transaction: BankingTransaction): void {
    this.bankingTransactions.push(transaction);
  }

  getBankingTransactions(): BankingTransaction[] {
    return this.bankingTransactions;
  }

  setBankingTransactions(transactions: BankingTransaction[]): void {
    this.bankingTransactions = transactions;
  }

  // Cash conferences
  addCashConference(conference: CashConference): void {
    this.cashConferences.push(conference);
  }

  getCashConferences(): CashConference[] {
    return this.cashConferences;
  }

  setCashConferences(conferences: CashConference[]): void {
    this.cashConferences = conferences;
  }

  // Scenario setup
  setupScenario(scenario: 'clean' | 'small' | 'medium' | 'large' = 'medium'): void {
    this.reset();

    if (scenario === 'clean') {
      return;
    }

    const testData = BatchFactory.createTestScenario(scenario);
    this.users = testData.users;
    this.bankingTransactions = testData.bankingTransactions;
    this.cashConferences = testData.cashConferences;

    // Set admin as current user by default
    this.currentUser = this.users.find(u => u.profile.role === 'admin') || this.users[0];
  }
}

export const mockState = new MockServerState();

// Mock response generators
export class MockResponseBuilder {
  static success<T>(data: T): MockResponse<T> {
    return {
      data,
      success: true
    };
  }

  static error(message: string): MockResponse {
    return {
      error: message,
      success: false
    };
  }

  static paginated<T>(
    data: T[],
    page: number = 1,
    limit: number = 50
  ): MockResponse<T[]> {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      success: true,
      total: data.length,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit)
      }
    };
  }

  static list<T>(data: T[]): MockResponse<T[]> {
    return {
      data,
      success: true,
      total: data.length
    };
  }
}

// Authentication mock handlers
export class AuthMockHandlers {
  static login(username: string, password: string): MockResponse<{ user: User; token: string }> {
    const user = mockState.getUsers().find(u => u.username === username);

    if (!user) {
      return MockResponseBuilder.error('Usuário não encontrado');
    }

    // Simple password validation for testing
    const validPasswords: Record<string, string> = {
      admin: 'admin123',
      user: 'user123',
      viewer: 'viewer123'
    };

    if (validPasswords[username] !== password) {
      return MockResponseBuilder.error('Usuário ou senha incorretos');
    }

    mockState.setCurrentUser(user);

    return MockResponseBuilder.success({
      user,
      token: `mock-token-${user.id}`
    });
  }

  static verify(): MockResponse<{ user: User }> {
    const user = mockState.getCurrentUser();

    if (!user) {
      return MockResponseBuilder.error('Token inválido');
    }

    return MockResponseBuilder.success({ user });
  }

  static logout(): MockResponse<{}> {
    mockState.setCurrentUser(null);
    return MockResponseBuilder.success({});
  }
}

// Banking transaction mock handlers
export class BankingMockHandlers {
  static getAll(
    page: number = 1,
    limit: number = 50,
    filters: Record<string, any> = {}
  ): MockResponse<BankingTransaction[]> {
    let transactions = mockState.getBankingTransactions();

    // Apply filters
    if (filters.status) {
      transactions = transactions.filter(t => t.status === filters.status);
    }

    if (filters.payment_type) {
      transactions = transactions.filter(t => t.payment_type === filters.payment_type);
    }

    if (filters.user_id) {
      transactions = transactions.filter(t => t.user_id === filters.user_id);
    }

    if (filters.start_date) {
      transactions = transactions.filter(t => t.transaction_date >= filters.start_date);
    }

    if (filters.end_date) {
      transactions = transactions.filter(t => t.transaction_date <= filters.end_date);
    }

    return MockResponseBuilder.paginated(transactions, page, limit);
  }

  static getById(id: string): MockResponse<BankingTransaction> {
    const transaction = mockState.getBankingTransactions().find(t => t.id === id);

    if (!transaction) {
      return MockResponseBuilder.error('Transação não encontrada');
    }

    return MockResponseBuilder.success(transaction);
  }

  static create(data: Partial<BankingTransaction>): MockResponse<BankingTransaction> {
    const transaction = createBankingTransaction()
      .with(data as any)
      .build();

    mockState.addBankingTransaction(transaction);

    return MockResponseBuilder.success(transaction);
  }

  static update(id: string, data: Partial<BankingTransaction>): MockResponse<BankingTransaction> {
    const transactions = mockState.getBankingTransactions();
    const index = transactions.findIndex(t => t.id === id);

    if (index === -1) {
      return MockResponseBuilder.error('Transação não encontrada');
    }

    transactions[index] = { ...transactions[index], ...data };

    return MockResponseBuilder.success(transactions[index]);
  }

  static delete(id: string): MockResponse<{}> {
    const transactions = mockState.getBankingTransactions();
    const index = transactions.findIndex(t => t.id === id);

    if (index === -1) {
      return MockResponseBuilder.error('Transação não encontrada');
    }

    transactions.splice(index, 1);

    return MockResponseBuilder.success({});
  }

  static search(query: string): MockResponse<BankingTransaction[]> {
    const transactions = mockState.getBankingTransactions();
    const searchResults = transactions.filter(t =>
      t.original_history.toLowerCase().includes(query.toLowerCase()) ||
      t.cpf?.includes(query) ||
      t.cnpj?.includes(query) ||
      t.value.toString().includes(query.replace(',', '.'))
    );

    return MockResponseBuilder.list(searchResults);
  }
}

// File upload mock handlers
export class UploadMockHandlers {
  static processFile(
    file: File,
    options: { shouldFail?: boolean; rowCount?: number } = {}
  ): MockResponse<{ rowsProcessed: number; data: BankingTransaction[] }> {
    if (options.shouldFail) {
      return MockResponseBuilder.error('Erro ao processar arquivo');
    }

    const rowCount = options.rowCount || 10;
    const transactions = createBankingTransaction().buildList(rowCount);

    // Add to mock state
    transactions.forEach(t => mockState.addBankingTransaction(t));

    return MockResponseBuilder.success({
      rowsProcessed: rowCount,
      data: transactions
    });
  }

  static validateFile(file: File): MockResponse<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // File type validation
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      errors.push('Tipo de arquivo não suportado');
    }

    // File size validation (10MB)
    if (file.size > 10 * 1024 * 1024) {
      errors.push('Arquivo muito grande (máximo 10MB)');
    }

    return MockResponseBuilder.success({
      isValid: errors.length === 0,
      errors
    });
  }
}

// Conference mock handlers
export class ConferenceMockHandlers {
  static getAll(
    page: number = 1,
    limit: number = 50,
    filters: Record<string, any> = {}
  ): MockResponse<CashConference[]> {
    let conferences = mockState.getCashConferences();

    // Apply filters
    if (filters.status) {
      conferences = conferences.filter(c => c.conference_status === filters.status);
    }

    if (filters.user_id) {
      conferences = conferences.filter(c => c.user_id === filters.user_id);
    }

    return MockResponseBuilder.paginated(conferences, page, limit);
  }

  static create(data: Partial<CashConference>): MockResponse<CashConference> {
    const conference = createCashConference()
      .with(data as any)
      .build();

    mockState.addCashConference(conference);

    return MockResponseBuilder.success(conference);
  }

  static complete(id: string): MockResponse<CashConference> {
    const conferences = mockState.getCashConferences();
    const index = conferences.findIndex(c => c.id === id);

    if (index === -1) {
      return MockResponseBuilder.error('Conferência não encontrada');
    }

    conferences[index].conference_status = 'completed';

    return MockResponseBuilder.success(conferences[index]);
  }
}

// Network simulation utilities
export class NetworkSimulator {
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async withDelay<T>(response: MockResponse<T>, ms: number = 500): Promise<MockResponse<T>> {
    await this.delay(ms);
    return response;
  }

  static async withRandomDelay<T>(
    response: MockResponse<T>,
    minMs: number = 100,
    maxMs: number = 1000
  ): Promise<MockResponse<T>> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await this.delay(delay);
    return response;
  }

  static withFailureRate<T>(
    response: MockResponse<T>,
    failureRate: number = 0.1
  ): MockResponse<T> {
    if (Math.random() < failureRate) {
      return MockResponseBuilder.error('Falha na rede');
    }
    return response;
  }
}

// Complete mock server setup
export class MockServer {
  static setup(scenario: 'clean' | 'small' | 'medium' | 'large' = 'medium'): void {
    mockState.setupScenario(scenario);
  }

  static reset(): void {
    mockState.reset();
  }

  static getHandlers() {
    return {
      auth: AuthMockHandlers,
      banking: BankingMockHandlers,
      upload: UploadMockHandlers,
      conference: ConferenceMockHandlers
    };
  }

  static getState() {
    return mockState;
  }

  static simulate() {
    return NetworkSimulator;
  }
}

export default MockServer;