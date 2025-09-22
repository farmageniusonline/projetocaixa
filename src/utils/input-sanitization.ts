/**
 * Comprehensive input sanitization utilities for security
 */

import { logger } from './logger';

// Security logger for input sanitization
const securityLogger = logger.createModule('SECURITY');

// ==========================================
// Basic Sanitization Functions
// ==========================================

/**
 * Remove potentially dangerous HTML/JS content from strings
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    securityLogger.warn('Non-string input passed to sanitizeHtml', { input: typeof input });
    return String(input);
  }

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove object tags
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove embed tags
    .replace(/<link\b[^<]*>/gi, '') // Remove link tags
    .replace(/<meta\b[^<]*>/gi, '') // Remove meta tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:text\/html/gi, '') // Remove data URLs with HTML
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/style\s*=/gi, '') // Remove inline styles
    .trim();
}

/**
 * Sanitize general text input
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    securityLogger.warn('Non-string input passed to sanitizeText', { input: typeof input });
    return '';
  }

  return sanitizeHtml(input)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, maxLength)
    .trim();
}

/**
 * Sanitize SQL-like input to prevent injection
 */
export function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous SQL keywords and characters
  return input
    .replace(/['"`;\\]/g, '') // Remove quotes, semicolons, backslashes
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|UNION|SELECT|SCRIPT)\b/gi, '')
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments start
    .replace(/\*\//g, '') // Remove SQL block comments end
    .trim();
}

// ==========================================
// Specific Data Type Sanitization
// ==========================================

/**
 * Sanitize CPF input (Brazilian individual taxpayer registry)
 */
export function sanitizeCPF(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[^\d.-]/g, '') // Keep only digits, dots, and hyphens
    .substring(0, 14) // Max CPF length with formatting
    .trim();
}

/**
 * Sanitize CNPJ input (Brazilian company registry)
 */
export function sanitizeCNPJ(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[^\d./-]/g, '') // Keep only digits, dots, slashes, and hyphens
    .substring(0, 18) // Max CNPJ length with formatting
    .trim();
}

/**
 * Sanitize monetary values
 */
export function sanitizeCurrency(input: string): string {
  if (typeof input !== 'string') {
    return '0';
  }

  return input
    .replace(/[^\d,.-]/g, '') // Keep only digits, commas, dots, and minus
    .replace(/,/g, '.') // Normalize decimal separator
    .substring(0, 20) // Reasonable limit for monetary values
    .trim();
}

/**
 * Sanitize Brazilian date format (DD/MM/YYYY)
 */
export function sanitizeBrazilianDate(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[^\d/]/g, '') // Keep only digits and slashes
    .substring(0, 10) // DD/MM/YYYY format
    .trim();
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[^a-zA-Z0-9@._-]/g, '') // Keep only valid email characters
    .toLowerCase()
    .substring(0, 254) // RFC 5322 email length limit
    .trim();
}

/**
 * Sanitize phone numbers (Brazilian format)
 */
export function sanitizePhone(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[^\d()+-\s]/g, '') // Keep only digits, parentheses, plus, minus, and spaces
    .substring(0, 20) // Reasonable phone number length
    .trim();
}

/**
 * Sanitize filenames for safe file operations
 */
export function sanitizeFilename(input: string): string {
  if (typeof input !== 'string') {
    return 'untitled';
  }

  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid filename characters
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255) // File system limit
    .trim() || 'untitled';
}

// ==========================================
// Advanced Sanitization Functions
// ==========================================

/**
 * Sanitize JSON input to prevent injection
 */
export function sanitizeJson(input: string): string {
  if (typeof input !== 'string') {
    return '{}';
  }

  try {
    // Parse and stringify to ensure valid JSON
    const parsed = JSON.parse(input);
    return JSON.stringify(sanitizeObject(parsed));
  } catch {
    securityLogger.warn('Invalid JSON input sanitized', { input: input.substring(0, 100) });
    return '{}';
  }
}

/**
 * Recursively sanitize object properties
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)).slice(0, 1000); // Limit array size
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    let propertyCount = 0;

    for (const [key, value] of Object.entries(obj)) {
      if (propertyCount >= 100) { // Limit object properties
        securityLogger.warn('Object property limit reached during sanitization');
        break;
      }

      const sanitizedKey = sanitizeText(key, 100);
      if (sanitizedKey && !sanitizedKey.startsWith('__')) { // Avoid prototype pollution
        sanitized[sanitizedKey] = sanitizeObject(value);
        propertyCount++;
      }
    }

    return sanitized;
  }

  return null;
}

/**
 * Sanitize URL inputs
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  try {
    const url = new URL(input);

    // Allow only safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(url.protocol)) {
      securityLogger.warn('Dangerous URL protocol blocked', { protocol: url.protocol });
      return '';
    }

    // Remove dangerous URL schemes
    const sanitized = input
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .substring(0, 2048); // URL length limit

    return sanitized;
  } catch {
    securityLogger.warn('Invalid URL format sanitized', { input: input.substring(0, 100) });
    return '';
  }
}

// ==========================================
// Rate Limiting and Input Validation
// ==========================================

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

/**
 * Check if input exceeds rate limit
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const key = `rate_limit_${identifier}`;

  const current = rateLimitStore.get(key);

  if (!current || now - current.lastReset > windowMs) {
    rateLimitStore.set(key, { count: 1, lastReset: now });
    return true;
  }

  if (current.count >= maxAttempts) {
    securityLogger.warn('Rate limit exceeded', { identifier, count: current.count });
    return false;
  }

  current.count++;
  return true;
}

/**
 * Validate input against common attack patterns
 */
export function validateInputSafety(input: string): {
  isSafe: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (typeof input !== 'string') {
    violations.push('Non-string input');
    return { isSafe: false, violations };
  }

  // Check for common attack patterns
  const dangerousPatterns = [
    { pattern: /<script/gi, type: 'XSS script tag' },
    { pattern: /javascript:/gi, type: 'JavaScript protocol' },
    { pattern: /on\w+\s*=/gi, type: 'Event handler' },
    { pattern: /\bUNION\b.*\bSELECT\b/gi, type: 'SQL injection' },
    { pattern: /\bDROP\b.*\bTABLE\b/gi, type: 'SQL DROP command' },
    { pattern: /\.\.\//gi, type: 'Directory traversal' },
    { pattern: /\${.*}/g, type: 'Template injection' },
    { pattern: /<%.*%>/g, type: 'Server-side template' }
  ];

  for (const { pattern, type } of dangerousPatterns) {
    if (pattern.test(input)) {
      violations.push(type);
      securityLogger.warn('Dangerous pattern detected', { type, input: input.substring(0, 100) });
    }
  }

  return {
    isSafe: violations.length === 0,
    violations
  };
}

// ==========================================
// Sanitization Middleware
// ==========================================

/**
 * Comprehensive input sanitizer with configurable options
 */
export function sanitizeInput(
  input: any,
  options: {
    type?: 'text' | 'html' | 'email' | 'url' | 'cpf' | 'cnpj' | 'currency' | 'phone' | 'filename' | 'date';
    maxLength?: number;
    allowHtml?: boolean;
    strictMode?: boolean;
  } = {}
): string {
  const {
    type = 'text',
    maxLength = 1000,
    allowHtml = false,
    strictMode = true
  } = options;

  // Convert to string if needed
  let str = typeof input === 'string' ? input : String(input || '');

  // Rate limiting check in strict mode
  if (strictMode && !checkRateLimit(`sanitize_${type}`, 1000, 60000)) {
    return '';
  }

  // Safety validation in strict mode
  if (strictMode) {
    const safety = validateInputSafety(str);
    if (!safety.isSafe) {
      securityLogger.error('Unsafe input blocked', { violations: safety.violations });
      return '';
    }
  }

  // Apply type-specific sanitization
  switch (type) {
    case 'html':
      return allowHtml ? sanitizeText(str, maxLength) : sanitizeHtml(str).substring(0, maxLength);
    case 'email':
      return sanitizeEmail(str);
    case 'url':
      return sanitizeUrl(str);
    case 'cpf':
      return sanitizeCPF(str);
    case 'cnpj':
      return sanitizeCNPJ(str);
    case 'currency':
      return sanitizeCurrency(str);
    case 'phone':
      return sanitizePhone(str);
    case 'filename':
      return sanitizeFilename(str);
    case 'date':
      return sanitizeBrazilianDate(str);
    case 'text':
    default:
      return sanitizeText(str, maxLength);
  }
}

// ==========================================
// React Hook for Input Sanitization
// ==========================================

/**
 * React hook for safe input handling
 */
export function useSafeInput() {
  const handleSanitize = (
    value: string,
    type: Parameters<typeof sanitizeInput>[1]['type'] = 'text'
  ) => {
    return sanitizeInput(value, { type, strictMode: true });
  };

  const handleValidate = (value: string) => {
    return validateInputSafety(value);
  };

  return {
    sanitize: handleSanitize,
    validate: handleValidate,
    checkRate: checkRateLimit
  };
}

// ==========================================
// Export sanitization utilities
// ==========================================

export const sanitizers = {
  text: sanitizeText,
  html: sanitizeHtml,
  sql: sanitizeSqlInput,
  cpf: sanitizeCPF,
  cnpj: sanitizeCNPJ,
  currency: sanitizeCurrency,
  date: sanitizeBrazilianDate,
  email: sanitizeEmail,
  phone: sanitizePhone,
  filename: sanitizeFilename,
  url: sanitizeUrl,
  json: sanitizeJson,
  object: sanitizeObject
};

export const validators = {
  safety: validateInputSafety,
  rateLimit: checkRateLimit
};

export default {
  sanitizeInput,
  sanitizers,
  validators,
  useSafeInput
};