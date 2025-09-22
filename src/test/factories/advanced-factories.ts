/**
 * Advanced factory pattern implementation with builders and traits
 */

import type {
  User,
  Profile,
  BankingTransaction,
  CashConference,
  ParsedRow,
  BankEntryForProcessing
} from '../../types';

import { generateId, generateUuid, generateBrazilianDate } from './index';

// Factory builder interface
export interface FactoryBuilder<T> {
  with(overrides: Partial<T>): FactoryBuilder<T>;
  trait(traitName: string, ...args: any[]): FactoryBuilder<T>;
  sequence(field: keyof T, fn: (n: number) => any): FactoryBuilder<T>;
  build(): T;
  buildList(count: number): T[];
}

// Base factory class
abstract class BaseFactory<T> implements FactoryBuilder<T> {
  protected data: Partial<T> = {};
  protected traits: Record<string, (data: Partial<T>, ...args: any[]) => Partial<T>> = {};
  protected sequences: Record<string, (n: number) => any> = {};
  private sequenceCounters: Record<string, number> = {};

  constructor() {
    this.registerTraits();
  }

  protected abstract getDefaultData(): T;
  protected abstract registerTraits(): void;

  with(overrides: Partial<T>): FactoryBuilder<T> {
    this.data = { ...this.data, ...overrides };
    return this;
  }

  trait(traitName: string, ...args: any[]): FactoryBuilder<T> {
    const traitFn = this.traits[traitName];
    if (traitFn) {
      this.data = { ...this.data, ...traitFn(this.data, ...args) };
    }
    return this;
  }

  sequence(field: keyof T, fn: (n: number) => any): FactoryBuilder<T> {
    const fieldName = String(field);
    this.sequences[fieldName] = fn;
    this.sequenceCounters[fieldName] = this.sequenceCounters[fieldName] || 0;
    return this;
  }

  build(): T {
    const defaultData = this.getDefaultData();

    // Apply sequences
    for (const [field, fn] of Object.entries(this.sequences)) {
      this.sequenceCounters[field]++;
      (this.data as any)[field] = fn(this.sequenceCounters[field]);
    }

    return { ...defaultData, ...this.data };
  }

  buildList(count: number): T[] {
    return Array.from({ length: count }, () => {
      // Create a new instance for each item to avoid shared state
      const factory = this.clone();
      return factory.build();
    });
  }

  protected abstract clone(): BaseFactory<T>;
}

// Profile factory with traits
class ProfileFactory extends BaseFactory<Profile> {
  protected getDefaultData(): Profile {
    return {
      id: generateUuid(),
      username: `user-${generateId('profile')}`,
      full_name: 'Test User',
      role: 'user',
      is_active: true
    };
  }

  protected registerTraits(): void {
    this.traits = {
      admin: () => ({ role: 'admin' as const }),
      viewer: () => ({ role: 'viewer' as const }),
      inactive: () => ({ is_active: false }),
      withEmail: (data, email?: string) => ({
        email: email || `${data.username}@test.com`
      }),
      withPhone: (data, phone?: string) => ({
        phone: phone || '(11) 99999-9999'
      }),
      fullProfile: (data, email?: string, phone?: string) => ({
        email: email || `${data.username}@test.com`,
        phone: phone || '(11) 99999-9999',
        full_name: 'John Doe Silva',
        avatar_url: 'https://example.com/avatar.jpg'
      })
    };
  }

  protected clone(): ProfileFactory {
    const factory = new ProfileFactory();
    factory.data = { ...this.data };
    factory.sequenceCounters = { ...this.sequenceCounters };
    return factory;
  }
}

// User factory with traits
class UserFactory extends BaseFactory<User> {
  protected getDefaultData(): User {
    const profile = createProfile().build();
    return {
      username: profile.username,
      id: profile.id,
      email: profile.email,
      profile
    };
  }

  protected registerTraits(): void {
    this.traits = {
      admin: () => {
        const adminProfile = createProfile().trait('admin').build();
        return {
          profile: adminProfile,
          username: adminProfile.username,
          id: adminProfile.id
        };
      },
      viewer: () => {
        const viewerProfile = createProfile().trait('viewer').build();
        return {
          profile: viewerProfile,
          username: viewerProfile.username,
          id: viewerProfile.id
        };
      },
      withFullProfile: () => {
        const fullProfile = createProfile().trait('fullProfile').build();
        return {
          profile: fullProfile,
          username: fullProfile.username,
          id: fullProfile.id,
          email: fullProfile.email
        };
      }
    };
  }

  protected clone(): UserFactory {
    const factory = new UserFactory();
    factory.data = { ...this.data };
    factory.sequenceCounters = { ...this.sequenceCounters };
    return factory;
  }
}

// Banking transaction factory with traits
class BankingTransactionFactory extends BaseFactory<BankingTransaction> {
  protected getDefaultData(): BankingTransaction {
    const sequence = generateId('bank');
    return {
      id: generateUuid(),
      user_id: generateUuid(),
      transaction_date: generateBrazilianDate(),
      payment_type: 'PIX RECEBIDO',
      cpf: '12345678901',
      value: 100.00,
      original_history: `Test transaction ${sequence}`,
      status: 'pending',
      is_transferred: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  protected registerTraits(): void {
    this.traits = {
      pix: () => ({ payment_type: 'PIX RECEBIDO' as const }),
      ted: () => ({ payment_type: 'TED' as const }),
      card: () => ({ payment_type: 'CARTÃO' as const }),
      cash: () => ({ payment_type: 'DINHEIRO' as const }),

      withCnpj: (data, cnpj?: string) => ({
        cpf: undefined,
        cnpj: cnpj || '12345678000195'
      }),

      largeValue: () => ({ value: 10000.00 }),
      smallValue: () => ({ value: 10.00 }),

      conferred: () => ({ status: 'conferred' as const }),
      notFound: () => ({ status: 'not_found' as const }),
      transferred: () => ({
        status: 'conferred' as const,
        is_transferred: true
      }),

      recent: () => ({ transaction_date: generateBrazilianDate(0) }),
      lastWeek: () => ({ transaction_date: generateBrazilianDate(7) }),
      lastMonth: () => ({ transaction_date: generateBrazilianDate(30) }),

      withFile: (data, fileId?: string) => ({
        file_id: fileId || generateUuid(),
        row_index: Math.floor(Math.random() * 100)
      })
    };
  }

  protected clone(): BankingTransactionFactory {
    const factory = new BankingTransactionFactory();
    factory.data = { ...this.data };
    factory.sequenceCounters = { ...this.sequenceCounters };
    return factory;
  }
}

// Cash conference factory with traits
class CashConferenceFactory extends BaseFactory<CashConference> {
  protected getDefaultData(): CashConference {
    const sequence = generateId('conf');
    return {
      id: generateUuid(),
      user_id: generateUuid(),
      conferred_value: 100.00,
      conference_date: generateBrazilianDate(),
      transaction_date: generateBrazilianDate(),
      payment_type: 'PIX RECEBIDO',
      cpf: '12345678901',
      original_value: 100.00,
      original_history: `Test conference ${sequence}`,
      conference_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  protected registerTraits(): void {
    this.traits = {
      completed: () => ({ conference_status: 'completed' as const }),
      cancelled: () => ({ conference_status: 'cancelled' as const }),

      withDifference: (data, difference = 10) => ({
        original_value: 100.00,
        conferred_value: 100.00 + difference
      }),

      exactMatch: () => ({
        original_value: 100.00,
        conferred_value: 100.00
      }),

      withNotes: (data, notes?: string) => ({
        notes: notes || 'Test conference notes'
      }),

      largeDifference: () => ({
        original_value: 1000.00,
        conferred_value: 900.00
      })
    };
  }

  protected clone(): CashConferenceFactory {
    const factory = new CashConferenceFactory();
    factory.data = { ...this.data };
    factory.sequenceCounters = { ...this.sequenceCounters };
    return factory;
  }
}

// Parsed row factory for Excel processing
class ParsedRowFactory extends BaseFactory<ParsedRow> {
  protected getDefaultData(): ParsedRow {
    return {
      date: generateBrazilianDate(),
      paymentType: 'PIX RECEBIDO',
      cpf: '12345678901',
      value: 100.00,
      originalHistory: `Test parsed row ${generateId('row')}`
    };
  }

  protected registerTraits(): void {
    this.traits = {
      invalid: () => ({
        date: 'invalid-date',
        value: NaN,
        cpf: '123'
      }),

      withCnpj: (data, cnpj?: string) => ({
        cpf: undefined,
        cnpj: cnpj || '12345678000195'
      }),

      withValidation: (data, status = 'valid', message = '') => ({
        validationStatus: status as 'valid' | 'warning' | 'error',
        validationMessage: message
      })
    };
  }

  protected clone(): ParsedRowFactory {
    const factory = new ParsedRowFactory();
    factory.data = { ...this.data };
    factory.sequenceCounters = { ...this.sequenceCounters };
    return factory;
  }
}

// Factory creators
export function createProfile(): ProfileFactory {
  return new ProfileFactory();
}

export function createUser(): UserFactory {
  return new UserFactory();
}

export function createBankingTransaction(): BankingTransactionFactory {
  return new BankingTransactionFactory();
}

export function createCashConference(): CashConferenceFactory {
  return new CashConferenceFactory();
}

export function createParsedRow(): ParsedRowFactory {
  return new ParsedRowFactory();
}

// Batch factory utilities
export class BatchFactory {
  static createBankingDataset(size: number = 10): BankingTransaction[] {
    return [
      ...createBankingTransaction().trait('pix').buildList(Math.floor(size * 0.4)),
      ...createBankingTransaction().trait('ted').buildList(Math.floor(size * 0.2)),
      ...createBankingTransaction().trait('card').buildList(Math.floor(size * 0.2)),
      ...createBankingTransaction().trait('cash').buildList(Math.floor(size * 0.2))
    ];
  }

  static createConferenceDataset(size: number = 10): CashConference[] {
    return [
      ...createCashConference().trait('completed').buildList(Math.floor(size * 0.6)),
      ...createCashConference().trait('active').buildList(Math.floor(size * 0.3)),
      ...createCashConference().trait('cancelled').buildList(Math.floor(size * 0.1))
    ];
  }

  static createUserRoles(): User[] {
    return [
      createUser().trait('admin').with({ username: 'admin' }).build(),
      createUser().trait('viewer').with({ username: 'viewer' }).build(),
      ...createUser().buildList(3)
    ];
  }

  static createTestScenario(scenario: 'small' | 'medium' | 'large' = 'medium') {
    const sizes = {
      small: { banks: 10, conferences: 5, users: 2 },
      medium: { banks: 100, conferences: 50, users: 5 },
      large: { banks: 1000, conferences: 500, users: 10 }
    };

    const { banks, conferences, users } = sizes[scenario];

    return {
      users: this.createUserRoles().slice(0, users),
      bankingTransactions: this.createBankingDataset(banks),
      cashConferences: this.createConferenceDataset(conferences)
    };
  }
}

// Export all factories and utilities
export {
  ProfileFactory,
  UserFactory,
  BankingTransactionFactory,
  CashConferenceFactory,
  ParsedRowFactory,
  BatchFactory
};