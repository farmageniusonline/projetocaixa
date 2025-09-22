/**
 * Secure environment configuration with validation and type safety
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

// Environment validation schema
const environmentSchema = z.object({
  // Supabase Configuration
  VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  VITE_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VITE_DATABASE_MODE: z.enum(['supabase', 'indexeddb', 'hybrid']).default('supabase'),
  VITE_ORG_NAME: z.string().optional(),
  VITE_PROJECT_NAME: z.string().optional(),

  // Security Configuration
  VITE_SESSION_TIMEOUT: z.string().regex(/^\d+$/, 'Session timeout must be a number').transform(Number).default('86400'),
  VITE_MAX_FILE_SIZE: z.string().regex(/^\d+$/, 'Max file size must be a number').transform(Number).default('10485760'),
  VITE_WORKER_TIMEOUT: z.string().regex(/^\d+$/, 'Worker timeout must be a number').transform(Number).default('30000'),
  VITE_MAX_RETRY_ATTEMPTS: z.string().regex(/^\d+$/, 'Max retry attempts must be a number').transform(Number).default('3'),

  // Feature Flags
  VITE_ENABLE_AUDIT_LOGGING: z.string().transform(val => val === 'true').default('true'),
  VITE_ENABLE_DEBUG_LOGGING: z.string().transform(val => val === 'true').default('false'),
  VITE_ENABLE_PERFORMANCE_MONITORING: z.string().transform(val => val === 'true').default('false'),
  VITE_ENABLE_OFFLINE_MODE: z.string().transform(val => val === 'true').default('true'),
  VITE_ENABLE_EXPORT_FEATURES: z.string().transform(val => val === 'true').default('true'),
  VITE_ENABLE_ADVANCED_SEARCH: z.string().transform(val => val === 'true').default('true'),

  // Optional Integrations
  VITE_API_BASE_URL: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_ANALYTICS_ID: z.string().optional(),

  // Security Headers
  VITE_CSP_DIRECTIVES: z.string().optional(),
  VITE_FORCE_HTTPS: z.string().transform(val => val === 'true').default('false'),
  VITE_SECURE_COOKIES: z.string().transform(val => val === 'true').default('true'),
  VITE_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict')
});

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

// Validate and parse environment variables
function validateEnvironment(): EnvironmentConfig {
  try {
    const envVars = {
      // Required variables
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
      VITE_SUPABASE_SERVICE_ROLE_KEY: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,

      // Environment and mode
      NODE_ENV: import.meta.env.NODE_ENV || 'development',
      VITE_DATABASE_MODE: import.meta.env.VITE_DATABASE_MODE || 'supabase',
      VITE_ORG_NAME: import.meta.env.VITE_ORG_NAME,
      VITE_PROJECT_NAME: import.meta.env.VITE_PROJECT_NAME,

      // Security settings
      VITE_SESSION_TIMEOUT: import.meta.env.VITE_SESSION_TIMEOUT || '86400',
      VITE_MAX_FILE_SIZE: import.meta.env.VITE_MAX_FILE_SIZE || '10485760',
      VITE_WORKER_TIMEOUT: import.meta.env.VITE_WORKER_TIMEOUT || '30000',
      VITE_MAX_RETRY_ATTEMPTS: import.meta.env.VITE_MAX_RETRY_ATTEMPTS || '3',

      // Feature flags
      VITE_ENABLE_AUDIT_LOGGING: import.meta.env.VITE_ENABLE_AUDIT_LOGGING || 'true',
      VITE_ENABLE_DEBUG_LOGGING: import.meta.env.VITE_ENABLE_DEBUG_LOGGING || 'false',
      VITE_ENABLE_PERFORMANCE_MONITORING: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING || 'false',
      VITE_ENABLE_OFFLINE_MODE: import.meta.env.VITE_ENABLE_OFFLINE_MODE || 'true',
      VITE_ENABLE_EXPORT_FEATURES: import.meta.env.VITE_ENABLE_EXPORT_FEATURES || 'true',
      VITE_ENABLE_ADVANCED_SEARCH: import.meta.env.VITE_ENABLE_ADVANCED_SEARCH || 'true',

      // Optional integrations
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_ANALYTICS_ID: import.meta.env.VITE_ANALYTICS_ID,

      // Security headers
      VITE_CSP_DIRECTIVES: import.meta.env.VITE_CSP_DIRECTIVES,
      VITE_FORCE_HTTPS: import.meta.env.VITE_FORCE_HTTPS || 'false',
      VITE_SECURE_COOKIES: import.meta.env.VITE_SECURE_COOKIES || 'true',
      VITE_COOKIE_SAME_SITE: import.meta.env.VITE_COOKIE_SAME_SITE || 'strict'
    };

    const result = environmentSchema.parse(envVars);

    logger.info('Environment configuration validated successfully', {
      nodeEnv: result.NODE_ENV,
      databaseMode: result.VITE_DATABASE_MODE,
      orgName: result.VITE_ORG_NAME,
      enabledFeatures: {
        auditLogging: result.VITE_ENABLE_AUDIT_LOGGING,
        debugLogging: result.VITE_ENABLE_DEBUG_LOGGING,
        offlineMode: result.VITE_ENABLE_OFFLINE_MODE,
        exportFeatures: result.VITE_ENABLE_EXPORT_FEATURES
      }
    });

    return result;
  } catch (error) {
    logger.error('Environment validation failed', { error });

    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment configuration errors:\n${missingVars.join('\n')}`);
    }

    throw new Error('Failed to validate environment configuration');
  }
}

// Validated environment configuration
export const env = validateEnvironment();

// Security helpers
export const security = {
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isSecureContext: env.VITE_FORCE_HTTPS || window.location.protocol === 'https:',

  // Get CSP directives
  getCSPDirectives(): string {
    return env.VITE_CSP_DIRECTIVES || "default-src 'self'; script-src 'self' 'unsafe-inline'";
  },

  // Check if feature is enabled
  isFeatureEnabled(feature: keyof Pick<EnvironmentConfig,
    'VITE_ENABLE_AUDIT_LOGGING' |
    'VITE_ENABLE_DEBUG_LOGGING' |
    'VITE_ENABLE_PERFORMANCE_MONITORING' |
    'VITE_ENABLE_OFFLINE_MODE' |
    'VITE_ENABLE_EXPORT_FEATURES' |
    'VITE_ENABLE_ADVANCED_SEARCH'
  >): boolean {
    return env[feature];
  },

  // Get session configuration
  getSessionConfig() {
    return {
      timeout: env.VITE_SESSION_TIMEOUT,
      secureCookies: env.VITE_SECURE_COOKIES,
      sameSite: env.VITE_COOKIE_SAME_SITE,
      forceHttps: env.VITE_FORCE_HTTPS
    };
  },

  // Get file upload limits
  getUploadLimits() {
    return {
      maxFileSize: env.VITE_MAX_FILE_SIZE,
      maxRetryAttempts: env.VITE_MAX_RETRY_ATTEMPTS,
      workerTimeout: env.VITE_WORKER_TIMEOUT
    };
  },

  // Sanitize configuration for logging (remove sensitive data)
  getSafeConfig(): Partial<EnvironmentConfig> {
    const { VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_SERVICE_ROLE_KEY, ...safeConfig } = env;
    return {
      ...safeConfig,
      VITE_SUPABASE_ANON_KEY: VITE_SUPABASE_ANON_KEY ? '[REDACTED]' : undefined,
      VITE_SUPABASE_SERVICE_ROLE_KEY: VITE_SUPABASE_SERVICE_ROLE_KEY ? '[REDACTED]' : undefined
    };
  }
};

// Runtime environment checks
export const checks = {
  // Verify required environment variables
  verifyRequiredVars(): boolean {
    const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
    const missing = required.filter(key => !env[key as keyof EnvironmentConfig]);

    if (missing.length > 0) {
      logger.error('Missing required environment variables', { missing });
      return false;
    }

    return true;
  },

  // Check if running in secure context
  isSecureContext(): boolean {
    return security.isSecureContext;
  },

  // Validate Supabase configuration
  validateSupabase(): boolean {
    try {
      const url = new URL(env.VITE_SUPABASE_URL);
      const isValidDomain = url.hostname.includes('supabase.co') || url.hostname.includes('localhost');

      if (!isValidDomain) {
        logger.warn('Supabase URL does not appear to be a valid Supabase domain');
      }

      return true;
    } catch {
      logger.error('Invalid Supabase URL format');
      return false;
    }
  }
};

// Initialize security headers if in browser
if (typeof window !== 'undefined' && security.isProduction) {
  // Set CSP meta tag if not already present
  if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    const cspMeta = document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    cspMeta.content = security.getCSPDirectives();
    document.head.appendChild(cspMeta);
  }

  // Enforce HTTPS if configured
  if (env.VITE_FORCE_HTTPS && window.location.protocol === 'http:') {
    logger.warn('Redirecting to HTTPS');
    window.location.replace(window.location.href.replace('http:', 'https:'));
  }
}

export default env;