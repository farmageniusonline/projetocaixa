/**
 * Strict TypeScript utilities and types for enhanced type safety
 */

// Utility types for enhanced type safety

// Make all properties required and non-null
export type StrictRequired<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

// Strict object access helper
export type StrictKeyof<T> = keyof T extends string ? keyof T : never;

// Branded types for better type safety
export type Brand<T, U> = T & { readonly __brand: U };

// Common branded types
export type UserId = Brand<string, 'UserId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type ValueInCents = Brand<number, 'ValueInCents'>;
export type ISODateString = Brand<string, 'ISODateString'>;
export type BrazilianDateString = Brand<string, 'BrazilianDateString'>;

// Safe array access
export type SafeArrayAccess<T> = {
  readonly length: number;
  at(index: number): T | undefined;
  get(index: number): T | undefined;
  [Symbol.iterator](): Iterator<T>;
};

// Create safe array wrapper
export function createSafeArray<T>(array: T[]): SafeArrayAccess<T> {
  return {
    length: array.length,
    at: (index: number) => array.at(index),
    get: (index: number) => array[index],
    [Symbol.iterator]: () => array[Symbol.iterator]()
  };
}

// Strict object key access
export function getStrictKey<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K
): T[K] {
  if (!(key in obj)) {
    throw new Error(`Key "${String(key)}" not found in object`);
  }
  return obj[key];
}

// Safe object property access with default
export function getProperty<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: T[K]
): T[K] {
  return key in obj ? obj[key] : defaultValue;
}

// Type guard utilities
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// Strict date validation
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isISODateString(value: unknown): value is ISODateString {
  if (!isString(value)) return false;
  const date = new Date(value);
  return isValidDate(date) && value === date.toISOString();
}

export function isBrazilianDateString(value: unknown): value is BrazilianDateString {
  if (!isString(value)) return false;
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  return regex.test(value);
}

// Strict number validation
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

// Strict string validation
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isCPF(value: unknown): value is string {
  if (!isString(value)) return false;
  const cpfRegex = /^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
  return cpfRegex.test(value);
}

// Strict value conversion utilities
export function toUserId(value: string): UserId {
  if (!isNonEmptyString(value)) {
    throw new Error('Invalid user ID');
  }
  return value as UserId;
}

export function toTransactionId(value: string): TransactionId {
  if (!isNonEmptyString(value)) {
    throw new Error('Invalid transaction ID');
  }
  return value as TransactionId;
}

export function toValueInCents(value: number): ValueInCents {
  if (!isNonNegativeNumber(value) || !isInteger(value)) {
    throw new Error('Value in cents must be a non-negative integer');
  }
  return value as ValueInCents;
}

export function toISODateString(value: string | Date): ISODateString {
  let date: Date;

  if (isString(value)) {
    date = new Date(value);
  } else if (isValidDate(value)) {
    date = value;
  } else {
    throw new Error('Invalid date value');
  }

  if (!isValidDate(date)) {
    throw new Error('Invalid date');
  }

  return date.toISOString() as ISODateString;
}

export function toBrazilianDateString(value: string): BrazilianDateString {
  if (!isBrazilianDateString(value)) {
    throw new Error('Invalid Brazilian date format (DD/MM/YYYY)');
  }
  return value;
}

// Strict parsing utilities
export interface ParseResult<T> {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
}

export function parseJSON<T>(json: string): ParseResult<T> {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'JSON parse error'
    };
  }
}

export function parseNumber(value: unknown): ParseResult<number> {
  if (isNumber(value)) {
    return { success: true, data: value };
  }

  if (isString(value)) {
    const parsed = Number(value);
    if (!isNaN(parsed)) {
      return { success: true, data: parsed };
    }
  }

  return { success: false, error: 'Not a valid number' };
}

export function parsePositiveNumber(value: unknown): ParseResult<number> {
  const numberResult = parseNumber(value);
  if (!numberResult.success) {
    return numberResult;
  }

  if (numberResult.data <= 0) {
    return { success: false, error: 'Number must be positive' };
  }

  return numberResult;
}

// Strict error handling
export class StrictError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StrictError';
  }
}

export function createStrictError(
  message: string,
  code: string,
  context?: Record<string, unknown>
): StrictError {
  return new StrictError(message, code, context);
}

// Strict async utilities
export type StrictPromise<T> = Promise<T>;

export async function strictTry<T>(
  operation: () => Promise<T>
): Promise<ParseResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Type assertion utilities
export function assertIsString(value: unknown, message?: string): asserts value is string {
  if (!isString(value)) {
    throw new StrictError(message || 'Value is not a string', 'ASSERTION_ERROR', { value });
  }
}

export function assertIsNumber(value: unknown, message?: string): asserts value is number {
  if (!isNumber(value)) {
    throw new StrictError(message || 'Value is not a number', 'ASSERTION_ERROR', { value });
  }
}

export function assertIsNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new StrictError(message || 'Value is null or undefined', 'ASSERTION_ERROR', { value });
  }
}

// Exhaustive checking for union types
export function assertNever(value: never): never {
  throw new StrictError(
    `Unexpected value: ${JSON.stringify(value)}`,
    'EXHAUSTIVE_CHECK_ERROR',
    { value }
  );
}

// Strict configuration type
export interface StrictConfig {
  enableRuntimeChecks: boolean;
  throwOnInvalidAccess: boolean;
  logWarnings: boolean;
}

let strictConfig: StrictConfig = {
  enableRuntimeChecks: import.meta.env.NODE_ENV === 'development',
  throwOnInvalidAccess: import.meta.env.NODE_ENV === 'development',
  logWarnings: true
};

export function configureStrictMode(config: Partial<StrictConfig>): void {
  strictConfig = { ...strictConfig, ...config };
}

export function getStrictConfig(): Readonly<StrictConfig> {
  return strictConfig;
}