/**
 * Comprehensive validation schemas using Zod for complete type safety
 */

import { z } from 'zod';

// Base validation utilities
const nonEmptyString = z.string().min(1, 'Campo obrigatório').trim();
const optionalString = z.string().optional().or(z.literal(''));
const positiveNumber = z.number().positive('Deve ser um número positivo');
const nonNegativeNumber = z.number().min(0, 'Não pode ser negativo');

// Brazilian specific validators
const cpfRegex = /^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const cnpjRegex = /^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const brazilianDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
const brazilianPhoneRegex = /^\(\d{2}\)\s\d{4,5}-\d{4}$|^\d{10,11}$/;

// Custom validators
const brazilianDate = z.string().regex(brazilianDateRegex, 'Data deve estar no formato DD/MM/AAAA');
const cpfValidator = z.string().regex(cpfRegex, 'CPF inválido');
const cnpjValidator = z.string().regex(cnpjRegex, 'CNPJ inválido');
const emailValidator = z.string().email('Email inválido').toLowerCase();
const phoneValidator = z.string().regex(brazilianPhoneRegex, 'Telefone inválido');

// Currency value validator (accepts both number and string)
const currencyValue = z.union([
  z.number(),
  z.string().transform((val) => {
    const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error('Valor monetário inválido');
    }
    return parsed;
  })
]).refine((val) => val >= 0, 'Valor deve ser positivo');

// ==========================================
// User and Authentication Schemas
// ==========================================

export const userProfileSchema = z.object({
  id: z.string().uuid('ID deve ser um UUID válido'),
  username: nonEmptyString.min(3, 'Username deve ter pelo menos 3 caracteres')
    .max(30, 'Username deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username pode conter apenas letras, números, _ e -'),
  full_name: optionalString.max(100, 'Nome completo muito longo'),
  avatar_url: z.string().url('URL do avatar inválida').optional(),
  role: z.enum(['admin', 'user', 'viewer'], {
    errorMap: () => ({ message: 'Role deve ser admin, user ou viewer' })
  }),
  is_active: z.boolean(),
  email: emailValidator.optional(),
  phone: phoneValidator.optional(),
  created_at: z.string().datetime('Data de criação inválida').optional(),
  updated_at: z.string().datetime('Data de atualização inválida').optional()
});

export const loginSchema = z.object({
  username: nonEmptyString.min(3, 'Username deve ter pelo menos 3 caracteres'),
  password: nonEmptyString.min(6, 'Senha deve ter pelo menos 6 caracteres'),
  rememberMe: z.boolean().optional().default(false)
});

export const passwordChangeSchema = z.object({
  currentPassword: nonEmptyString,
  newPassword: nonEmptyString.min(8, 'Nova senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número'),
  confirmPassword: nonEmptyString
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword']
});

// ==========================================
// Banking and Transaction Schemas
// ==========================================

export const bankingTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid('User ID deve ser um UUID válido'),
  transaction_date: brazilianDate,
  payment_type: z.enum([
    'PIX RECEBIDO',
    'PIX ENVIADO',
    'TED',
    'DOC',
    'CARTÃO',
    'DINHEIRO',
    'BOLETO',
    'TRANSFERÊNCIA',
    'DEPÓSITO',
    'SAQUE',
    'OUTROS'
  ], {
    errorMap: () => ({ message: 'Tipo de pagamento inválido' })
  }),
  cpf: cpfValidator.optional(),
  cnpj: cnpjValidator.optional(),
  value: currencyValue,
  original_history: nonEmptyString.max(500, 'Histórico muito longo'),
  status: z.enum(['pending', 'conferred', 'not_found', 'archived'], {
    errorMap: () => ({ message: 'Status inválido' })
  }).default('pending'),
  is_transferred: z.boolean().default(false),
  file_id: z.string().uuid().optional(),
  row_index: z.number().int().min(0).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
}).refine((data) => data.cpf || data.cnpj, {
  message: 'CPF ou CNPJ é obrigatório',
  path: ['cpf']
});

export const cashConferenceSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid('User ID deve ser um UUID válido'),
  conferred_value: currencyValue,
  conference_date: brazilianDate,
  transaction_date: brazilianDate,
  payment_type: z.string().min(1, 'Tipo de pagamento obrigatório'),
  cpf: cpfValidator.optional(),
  cnpj: cnpjValidator.optional(),
  original_value: currencyValue,
  original_history: optionalString.max(500, 'Histórico muito longo'),
  conference_status: z.enum(['active', 'completed', 'cancelled']).default('active'),
  notes: optionalString.max(1000, 'Notas muito longas'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

// ==========================================
// Excel Processing Schemas
// ==========================================

export const parsedExcelRowSchema = z.object({
  date: brazilianDate,
  paymentType: nonEmptyString,
  cpf: cpfValidator.optional(),
  cnpj: cnpjValidator.optional(),
  value: currencyValue,
  originalHistory: nonEmptyString.max(500, 'Histórico muito longo'),
  validationStatus: z.enum(['valid', 'warning', 'error']).optional(),
  validationMessage: optionalString,
  rowIndex: z.number().int().min(0).optional()
}).refine((data) => data.cpf || data.cnpj, {
  message: 'CPF ou CNPJ é obrigatório',
  path: ['cpf']
});

export const excelUploadSchema = z.object({
  file: z.instanceof(File, { message: 'Arquivo obrigatório' })
    .refine((file) => file.size > 0, 'Arquivo não pode estar vazio')
    .refine((file) => file.size <= 10 * 1024 * 1024, 'Arquivo muito grande (máximo 10MB)')
    .refine(
      (file) => [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ].includes(file.type),
      'Tipo de arquivo inválido (apenas .xlsx, .xls, .csv)'
    ),
  operationDate: brazilianDate,
  description: optionalString.max(200, 'Descrição muito longa')
});

export const bankEntrySchema = z.object({
  id: z.number().int().min(0),
  source_id: nonEmptyString,
  document_number: cpfValidator.or(cnpjValidator).optional(),
  date: brazilianDate.optional(),
  description: optionalString.max(500),
  value: currencyValue,
  value_cents: z.number().int().min(0),
  transaction_type: optionalString,
  balance: z.number().optional(),
  status: z.enum(['pending', 'conferred', 'not_found', 'transferred']),
  day: brazilianDate
});

// ==========================================
// Search and Filter Schemas
// ==========================================

export const searchFilterSchema = z.object({
  query: optionalString.max(100, 'Busca muito longa'),
  startDate: brazilianDate.optional(),
  endDate: brazilianDate.optional(),
  paymentType: optionalString,
  status: z.enum(['pending', 'conferred', 'not_found', 'archived', 'all']).optional(),
  minValue: currencyValue.optional(),
  maxValue: currencyValue.optional(),
  cpf: cpfValidator.optional(),
  cnpj: cnpjValidator.optional(),
  limit: z.number().int().min(1).max(1000).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['date', 'value', 'status', 'created_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).refine((data) => {
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate.split('/').reverse().join('-'));
    const end = new Date(data.endDate.split('/').reverse().join('-'));
    return start <= end;
  }
  return true;
}, {
  message: 'Data inicial deve ser anterior à data final',
  path: ['endDate']
}).refine((data) => {
  if (data.minValue !== undefined && data.maxValue !== undefined) {
    return data.minValue <= data.maxValue;
  }
  return true;
}, {
  message: 'Valor mínimo deve ser menor que valor máximo',
  path: ['maxValue']
});

// ==========================================
// Export and Report Schemas
// ==========================================

export const exportConfigSchema = z.object({
  format: z.enum(['excel', 'pdf', 'csv'], {
    errorMap: () => ({ message: 'Formato deve ser excel, pdf ou csv' })
  }),
  dateRange: z.object({
    start: brazilianDate,
    end: brazilianDate
  }).refine((data) => {
    const start = new Date(data.start.split('/').reverse().join('-'));
    const end = new Date(data.end.split('/').reverse().join('-'));
    return start <= end;
  }, 'Data inicial deve ser anterior à data final'),
  includeFilters: z.boolean().default(false),
  fields: z.array(z.string()).min(1, 'Pelo menos um campo deve ser selecionado').optional(),
  groupBy: z.enum(['date', 'payment_type', 'status']).optional(),
  includeStats: z.boolean().default(true),
  fileName: optionalString.max(100, 'Nome do arquivo muito longo')
});

// ==========================================
// System Configuration Schemas
// ==========================================

export const environmentConfigSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('URL do Supabase inválida'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Chave anônima do Supabase obrigatória'),
  VITE_WORKER_TIMEOUT: z.string().regex(/^\d+$/, 'Timeout deve ser um número').optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  VITE_API_BASE_URL: z.string().url('URL da API inválida').optional(),
  VITE_SENTRY_DSN: z.string().url('DSN do Sentry inválido').optional()
});

export const systemSettingsSchema = z.object({
  maxFileSize: z.number().int().min(1024).max(50 * 1024 * 1024), // 1KB to 50MB
  allowedFileTypes: z.array(z.string()).min(1),
  sessionTimeout: z.number().int().min(300).max(86400), // 5 minutes to 24 hours
  maxRetryAttempts: z.number().int().min(1).max(10),
  enableLogging: z.boolean(),
  enableAnalytics: z.boolean(),
  maintenanceMode: z.boolean()
});

// ==========================================
// API Response Schemas
// ==========================================

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    success: z.boolean()
  });

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    error: z.string().nullable(),
    success: z.boolean(),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0)
    }).optional()
  });

// ==========================================
// Validation Helper Functions
// ==========================================

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};

      error.errors.forEach((err) => {
        const field = err.path.join('.');
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(err.message);
      });

      return {
        success: false,
        error: 'Dados inválidos',
        fieldErrors
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de validação'
    };
  }
}

export function validatePartialWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<Partial<T>> {
  return validateWithSchema(schema.partial(), data);
}

// ==========================================
// Sanitization Functions
// ==========================================

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
}

export function sanitizeNumericInput(input: string): string {
  return input.replace(/[^\d,.-]/g, '');
}

export function sanitizeCPF(input: string): string {
  return input.replace(/[^\d]/g, '').substring(0, 11);
}

export function sanitizeCNPJ(input: string): string {
  return input.replace(/[^\d]/g, '').substring(0, 14);
}

// ==========================================
// Common Validation Patterns
// ==========================================

export const commonValidationPatterns = {
  // User input validation with sanitization
  validateUserInput: (input: unknown) =>
    validateWithSchema(z.string().transform(sanitizeInput), input),

  // File validation
  validateFile: (file: unknown) =>
    validateWithSchema(excelUploadSchema.shape.file, file),

  // Date range validation
  validateDateRange: (start: unknown, end: unknown) =>
    validateWithSchema(z.object({
      start: brazilianDate,
      end: brazilianDate
    }).refine((data) => {
      const startDate = new Date(data.start.split('/').reverse().join('-'));
      const endDate = new Date(data.end.split('/').reverse().join('-'));
      return startDate <= endDate;
    }, 'Data inicial deve ser anterior à data final'), { start, end }),

  // Currency validation
  validateCurrency: (value: unknown) =>
    validateWithSchema(currencyValue, value),

  // CPF validation with formatting
  validateCPF: (cpf: unknown) =>
    validateWithSchema(z.string().transform(sanitizeCPF).pipe(cpfValidator), cpf),

  // CNPJ validation with formatting
  validateCNPJ: (cnpj: unknown) =>
    validateWithSchema(z.string().transform(sanitizeCNPJ).pipe(cnpjValidator), cnpj)
};

// Export all schemas
export {
  userProfileSchema,
  loginSchema,
  passwordChangeSchema,
  bankingTransactionSchema,
  cashConferenceSchema,
  parsedExcelRowSchema,
  excelUploadSchema,
  bankEntrySchema,
  searchFilterSchema,
  exportConfigSchema,
  environmentConfigSchema,
  systemSettingsSchema
};