/**
 * Security middleware for request/response sanitization and validation
 */

import { sanitizeInput, validateInputSafety, sanitizeObject } from './input-sanitization';
import { createModuleLogger } from './logger';

const securityLogger = createModuleLogger('SECURITY_MIDDLEWARE');

// ==========================================
// Request Sanitization Middleware
// ==========================================

export interface SanitizedRequest {
  data: any;
  metadata: {
    sanitized: boolean;
    violations: string[];
    originalSize: number;
    sanitizedSize: number;
  };
}

/**
 * Sanitize API request data
 */
export function sanitizeApiRequest(data: any): SanitizedRequest {
  const originalSize = JSON.stringify(data).length;
  const violations: string[] = [];

  try {
    // Deep sanitize the request object
    const sanitizedData = sanitizeObject(data);

    // Validate for security violations
    const dataString = JSON.stringify(data);
    const safety = validateInputSafety(dataString);

    if (!safety.isSafe) {
      violations.push(...safety.violations);
      securityLogger.warn('Security violations detected in API request', {
        violations: safety.violations,
        originalSize
      });
    }

    const sanitizedSize = JSON.stringify(sanitizedData).length;

    return {
      data: sanitizedData,
      metadata: {
        sanitized: true,
        violations,
        originalSize,
        sanitizedSize
      }
    };
  } catch (error) {
    securityLogger.error('Failed to sanitize API request', { error, originalSize });

    return {
      data: {},
      metadata: {
        sanitized: false,
        violations: ['Sanitization failed'],
        originalSize,
        sanitizedSize: 0
      }
    };
  }
}

/**
 * Middleware for Supabase database operations
 */
export function sanitizeSupabasePayload<T extends Record<string, any>>(
  payload: T,
  tableName: string
): T {
  try {
    const sanitized = sanitizeObject(payload) as T;

    // Table-specific sanitization rules
    switch (tableName) {
      case 'bank_entries':
        return sanitizeBankEntry(sanitized);
      case 'cash_conferences':
        return sanitizeCashConference(sanitized);
      case 'profiles':
        return sanitizeProfile(sanitized);
      case 'manual_entries':
        return sanitizeManualEntry(sanitized);
      default:
        return sanitized;
    }
  } catch (error) {
    securityLogger.error('Failed to sanitize Supabase payload', { error, tableName });
    throw new Error('Data sanitization failed');
  }
}

// ==========================================
// Table-Specific Sanitization
// ==========================================

function sanitizeBankEntry(entry: any): any {
  return {
    ...entry,
    cpf: entry.cpf ? sanitizeInput(entry.cpf, { type: 'cpf' }) : null,
    cnpj: entry.cnpj ? sanitizeInput(entry.cnpj, { type: 'cnpj' }) : null,
    original_history: sanitizeInput(entry.original_history || '', { type: 'text', maxLength: 500 }),
    payment_type: sanitizeInput(entry.payment_type || '', { type: 'text', maxLength: 50 }),
    value: typeof entry.value === 'number' ? entry.value : parseFloat(
      sanitizeInput(String(entry.value || 0), { type: 'currency' })
    )
  };
}

function sanitizeCashConference(conference: any): any {
  return {
    ...conference,
    cpf: conference.cpf ? sanitizeInput(conference.cpf, { type: 'cpf' }) : null,
    cnpj: conference.cnpj ? sanitizeInput(conference.cnpj, { type: 'cnpj' }) : null,
    original_history: sanitizeInput(conference.original_history || '', { type: 'text', maxLength: 500 }),
    payment_type: sanitizeInput(conference.payment_type || '', { type: 'text', maxLength: 50 }),
    notes: sanitizeInput(conference.notes || '', { type: 'text', maxLength: 1000 }),
    conferred_value: typeof conference.conferred_value === 'number' ? conference.conferred_value : parseFloat(
      sanitizeInput(String(conference.conferred_value || 0), { type: 'currency' })
    ),
    original_value: typeof conference.original_value === 'number' ? conference.original_value : parseFloat(
      sanitizeInput(String(conference.original_value || 0), { type: 'currency' })
    )
  };
}

function sanitizeProfile(profile: any): any {
  return {
    ...profile,
    username: sanitizeInput(profile.username || '', { type: 'text', maxLength: 30 }),
    full_name: sanitizeInput(profile.full_name || '', { type: 'text', maxLength: 100 }),
    email: profile.email ? sanitizeInput(profile.email, { type: 'email' }) : null,
    phone: profile.phone ? sanitizeInput(profile.phone, { type: 'phone' }) : null,
    avatar_url: profile.avatar_url ? sanitizeInput(profile.avatar_url, { type: 'url' }) : null
  };
}

function sanitizeManualEntry(entry: any): any {
  return {
    ...entry,
    description: sanitizeInput(entry.description || '', { type: 'text', maxLength: 500 }),
    entry_type: sanitizeInput(entry.entry_type || '', { type: 'text', maxLength: 50 }),
    value: typeof entry.value === 'number' ? entry.value : parseFloat(
      sanitizeInput(String(entry.value || 0), { type: 'currency' })
    )
  };
}

// ==========================================
// Response Sanitization
// ==========================================

/**
 * Sanitize API response data
 */
export function sanitizeApiResponse(data: any): any {
  try {
    // Remove sensitive fields from responses
    return removeSensitiveFields(sanitizeObject(data));
  } catch (error) {
    securityLogger.error('Failed to sanitize API response', { error });
    return { error: 'Response sanitization failed' };
  }
}

/**
 * Remove sensitive fields from response data
 */
function removeSensitiveFields(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(removeSensitiveFields);
  }

  const sensitiveFields = [
    'password',
    'password_hash',
    'secret',
    'token',
    'private_key',
    'api_key',
    'access_token',
    'refresh_token',
    'session_token'
  ];

  const cleaned = { ...data };

  for (const field of sensitiveFields) {
    if (field in cleaned) {
      delete cleaned[field];
    }
  }

  // Recursively clean nested objects
  for (const [key, value] of Object.entries(cleaned)) {
    if (value && typeof value === 'object') {
      cleaned[key] = removeSensitiveFields(value);
    }
  }

  return cleaned;
}

// ==========================================
// File Upload Sanitization
// ==========================================

/**
 * Validate and sanitize file uploads
 */
export function sanitizeFileUpload(file: File): {
  isValid: boolean;
  sanitizedName: string;
  violations: string[];
  metadata: {
    originalName: string;
    size: number;
    type: string;
  };
} {
  const violations: string[] = [];
  const metadata = {
    originalName: file.name,
    size: file.size,
    type: file.type
  };

  // Sanitize filename
  const sanitizedName = sanitizeInput(file.name, { type: 'filename' });

  // Validate file type
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
    'application/json' // .json
  ];

  if (!allowedTypes.includes(file.type)) {
    violations.push('Invalid file type');
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    violations.push('File too large');
  }

  // Validate filename
  if (!sanitizedName || sanitizedName !== file.name) {
    violations.push('Invalid filename');
  }

  securityLogger.info('File upload validation', {
    originalName: file.name,
    sanitizedName,
    size: file.size,
    type: file.type,
    isValid: violations.length === 0,
    violations
  });

  return {
    isValid: violations.length === 0,
    sanitizedName,
    violations,
    metadata
  };
}

// ==========================================
// URL Parameter Sanitization
// ==========================================

/**
 * Sanitize URL parameters
 */
export function sanitizeUrlParams(params: URLSearchParams): URLSearchParams {
  const sanitized = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    const sanitizedKey = sanitizeInput(key, { type: 'text', maxLength: 50 });
    const sanitizedValue = sanitizeInput(value, { type: 'text', maxLength: 200 });

    if (sanitizedKey && sanitizedValue) {
      sanitized.append(sanitizedKey, sanitizedValue);
    }
  }

  return sanitized;
}

// ==========================================
// Security Headers
// ==========================================

/**
 * Generate security headers for responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  };
}

// ==========================================
// Rate Limiting Middleware
// ==========================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Clean old entries
  for (const [key, data] of rateLimitMap.entries()) {
    if (data.resetTime < windowStart) {
      rateLimitMap.delete(key);
    }
  }

  const current = rateLimitMap.get(identifier);

  if (!current || current.resetTime < windowStart) {
    const resetTime = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }

  if (current.count >= maxRequests) {
    securityLogger.warn('Rate limit exceeded', { identifier, count: current.count });
    return { allowed: false, remaining: 0, resetTime: current.resetTime };
  }

  current.count++;
  return { allowed: true, remaining: maxRequests - current.count, resetTime: current.resetTime };
}

// ==========================================
// Export middleware functions
// ==========================================

export const securityMiddleware = {
  sanitizeApiRequest,
  sanitizeApiResponse,
  sanitizeSupabasePayload,
  sanitizeFileUpload,
  sanitizeUrlParams,
  getSecurityHeaders,
  checkRateLimit,
  removeSensitiveFields
};

export default securityMiddleware;