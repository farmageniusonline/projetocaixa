// src/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

const createLogger = (level: LogLevel = 'error'): Logger => {
  const isDev = import.meta.env.MODE === 'development';
  const isProd = import.meta.env.MODE === 'production';

  return {
    debug: isDev && level === 'debug' ? console.log : () => {},
    info: isDev || level === 'info' ? console.info : () => {},
    warn: console.warn, // Always show warnings
    error: console.error // Always show errors
  };
};

export const logger = createLogger(
  import.meta.env.VITE_LOG_LEVEL as LogLevel ||
  (import.meta.env.MODE === 'development' ? 'debug' : 'error')
);

// Create specialized loggers for different modules (mantendo compatibilidade)
export const createModuleLogger = (moduleName: string, customLevel?: LogLevel): Logger => {
  const level = customLevel ||
    (import.meta.env.VITE_LOG_LEVEL as LogLevel) ||
    (import.meta.env.MODE === 'development' ? 'debug' : 'error');

  const baseLogger = createLogger(level);

  return {
    debug: (message: string, ...args: any[]) =>
      baseLogger.debug(`[${moduleName}] ${message}`, ...args),
    info: (message: string, ...args: any[]) =>
      baseLogger.info(`[${moduleName}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) =>
      baseLogger.warn(`[${moduleName}] ${message}`, ...args),
    error: (message: string, ...args: any[]) =>
      baseLogger.error(`[${moduleName}] ${message}`, ...args)
  };
};

// Specialized loggers mantidos para compatibilidade
export const perfLogger = createModuleLogger('PERF');
export const workerLogger = createModuleLogger('WORKER');
export const authLogger = createModuleLogger('AUTH', 'info'); // Always log auth events
export const dbLogger = createModuleLogger('DB');

// Export types for external usage
export type { Logger, LogLevel };