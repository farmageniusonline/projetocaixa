import { z } from 'zod';

/**
 * Centralized validation schemas using Zod
 * Provides consistent validation across the application
 */

// Base validation utilities
const cpfRegex = /^\d{11}$/;
const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ddmmyyyyRegex = /^\d{2}-\d{2}-\d{4}$/;

/**
 * CPF validation schema
 */
export const cpfSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, '')) // Remove non-digits
  .pipe(
    z.string()
      .length(11, { message: 'CPF deve ter 11 dígitos' })
      .regex(cpfRegex, { message: 'CPF deve conter apenas números' })
      .refine((cpf) => {
        // Basic CPF validation algorithm
        if (cpf === '00000000000' || cpf === '11111111111' ||
            cpf === '22222222222' || cpf === '33333333333' ||
            cpf === '44444444444' || cpf === '55555555555' ||
            cpf === '66666666666' || cpf === '77777777777' ||
            cpf === '88888888888' || cpf === '99999999999') {
          return false;
        }

        let sum = 0;
        for (let i = 0; i < 9; i++) {
          sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(9))) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) {
          sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(10))) return false;

        return true;
      }, { message: 'CPF inválido' })
  );

/**
 * Date validation schema (DD/MM/YYYY format)
 */
export const dateSchema = z
  .string()
  .min(1, { message: 'Data é obrigatória' })
  .regex(dateRegex, { message: 'Data deve estar no formato DD/MM/AAAA' })
  .refine((dateStr) => {
    const match = dateStr.match(dateRegex);
    if (!match) return false;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    // Basic date validation
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    // More precise validation using Date
    const date = new Date(year, month - 1, day);
    return date.getDate() === day &&
           date.getMonth() === month - 1 &&
           date.getFullYear() === year;
  }, { message: 'Data inválida' });

/**
 * DD-MM-YYYY date format schema
 */
export const ddmmyyyySchema = z
  .string()
  .min(1, { message: 'Data é obrigatória' })
  .regex(ddmmyyyyRegex, { message: 'Data deve estar no formato DD-MM-AAAA' })
  .refine((dateStr) => {
    const [day, month, year] = dateStr.split('-').map(num => parseInt(num, 10));

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    const date = new Date(year, month - 1, day);
    return date.getDate() === day &&
           date.getMonth() === month - 1 &&
           date.getFullYear() === year;
  }, { message: 'Data inválida' });

/**
 * Currency value validation schema
 * Accepts various Brazilian currency formats and converts to cents
 */
export const currencySchema = z
  .union([
    z.number(),
    z.string()
  ])
  .transform((val) => {
    if (typeof val === 'number') return val;

    // Remove currency symbols and clean the string
    const cleaned = val
      .replace(/[R$\s]/g, '') // Remove R$ and spaces
      .replace(/\./g, '') // Remove thousands separators
      .replace(',', '.'); // Convert decimal comma to dot

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  })
  .pipe(
    z.number()
      .finite({ message: 'Valor deve ser um número válido' })
      .min(0.01, { message: 'Valor deve ser maior que zero' })
      .max(999999999.99, { message: 'Valor muito alto' })
  );

/**
 * Value in cents schema (for precise calculations)
 */
export const valueCentsSchema = z
  .number()
  .int({ message: 'Valor em centavos deve ser inteiro' })
  .min(1, { message: 'Valor deve ser maior que zero' })
  .max(99999999999, { message: 'Valor muito alto' });

/**
 * Description/History text validation
 */
export const descriptionSchema = z
  .string()
  .min(1, { message: 'Descrição é obrigatória' })
  .max(500, { message: 'Descrição muito longa (máx. 500 caracteres)' })
  .transform((val) => val.trim());

/**
 * Optional description (can be empty)
 */
export const optionalDescriptionSchema = z
  .string()
  .max(500, { message: 'Descrição muito longa (máx. 500 caracteres)' })
  .transform((val) => val.trim())
  .optional();

/**
 * Banking entry validation schema
 */
export const bankingEntrySchema = z.object({
  date: dateSchema.optional(),
  document_number: cpfSchema.optional(),
  description: optionalDescriptionSchema,
  value: currencySchema,
  transaction_type: z.string().optional(),
  balance: z.number().optional()
});

/**
 * Manual entry validation schema
 */
export const manualEntrySchema = z.object({
  document_number: cpfSchema.optional(),
  description: descriptionSchema,
  value: currencySchema,
  entry_type: z.enum(['income', 'expense', 'transfer'], {
    errorMap: () => ({ message: 'Tipo deve ser: receita, despesa ou transferência' })
  }),
  category: z.string().optional()
});

/**
 * Cash conference validation schema
 */
export const cashConferenceSchema = z.object({
  value: currencySchema,
  document_number: cpfSchema.optional(),
  description: optionalDescriptionSchema
});

/**
 * Conference value search schema
 */
export const conferenceValueSchema = z.object({
  value: currencySchema
});

/**
 * Not found value schema
 */
export const notFoundValueSchema = z.object({
  value: currencySchema
});

/**
 * Excel row validation schema
 */
export const excelRowSchema = z.object({
  date: z.union([dateSchema, z.string().optional()]).optional(),
  paymentType: z.string().optional(),
  cpf: z.union([cpfSchema, z.string().optional()]).optional(),
  value: currencySchema,
  originalHistory: z.string().optional()
});

/**
 * Utility function to convert currency value to cents
 */
export const valueToCents = (value: number): number => {
  return Math.round(value * 100);
};

/**
 * Utility function to convert cents to currency value
 */
export const centsToValue = (cents: number): number => {
  return cents / 100;
};

/**
 * Format validation errors for user display
 */
export const formatValidationError = (error: z.ZodError): string => {
  if (!error.errors || error.errors.length === 0) {
    return 'Dados inválidos';
  }
  const firstError = error.errors[0];
  return firstError?.message || 'Dados inválidos';
};

/**
 * Safe validation function that returns result or error message
 */
export const safeValidate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: formatValidationError(result.error) };
  }
};

/**
 * Validation for file name
 */
export const fileNameSchema = z
  .string()
  .min(1, { message: 'Nome do arquivo é obrigatório' })
  .max(255, { message: 'Nome do arquivo muito longo' })
  .refine((name) => {
    // Check for valid file extensions
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    return validExtensions.some(ext => name.toLowerCase().endsWith(ext));
  }, { message: 'Arquivo deve ser Excel (.xlsx, .xls) ou CSV' });

/**
 * Validation for operation date
 */
export const operationDateSchema = ddmmyyyySchema;

/**
 * Common field validation schemas
 */
export const commonSchemas = {
  cpf: cpfSchema,
  date: dateSchema,
  ddmmyyyy: ddmmyyyySchema,
  currency: currencySchema,
  valueCents: valueCentsSchema,
  description: descriptionSchema,
  optionalDescription: optionalDescriptionSchema,
  fileName: fileNameSchema,
  operationDate: operationDateSchema
};

/**
 * Form validation schemas
 */
export const formSchemas = {
  bankingEntry: bankingEntrySchema,
  manualEntry: manualEntrySchema,
  cashConference: cashConferenceSchema,
  conferenceValue: conferenceValueSchema,
  notFoundValue: notFoundValueSchema,
  excelRow: excelRowSchema
};