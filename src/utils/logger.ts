type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableStackTrace: boolean;
  prefix?: string;
}

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

function shouldLog(configLevel: LogLevel, messageLevel: LogLevel): boolean {
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel];
}

function formatMessage(
  level: string,
  message: string,
  config: LoggerConfig,
  ...args: any[]
): [string, ...any[]] {
  const timestamp = config.enableTimestamp
    ? `[${new Date().toISOString()}]`
    : '';

  const prefix = config.prefix ? `[${config.prefix}]` : '';
  const levelPrefix = `[${level.toUpperCase()}]`;

  const formattedMessage = [timestamp, prefix, levelPrefix, message]
    .filter(Boolean)
    .join(' ');

  return [formattedMessage, ...args];
}

function createLogger(config: LoggerConfig): Logger {
  const logFunction = (
    level: LogLevel,
    consoleFn: (...args: any[]) => void,
    message: string,
    ...args: any[]
  ) => {
    if (!shouldLog(config.level, level)) return;

    const formattedArgs = formatMessage(level, message, config, ...args);

    if (config.enableStackTrace && level === 'error') {
      const stack = new Error().stack;
      formattedArgs.push('\nStack trace:', stack);
    }

    consoleFn(...formattedArgs);
  };

  return {
    debug: (message: string, ...args: any[]) =>
      logFunction('debug', console.log, message, ...args),

    info: (message: string, ...args: any[]) =>
      logFunction('info', console.info, message, ...args),

    warn: (message: string, ...args: any[]) =>
      logFunction('warn', console.warn, message, ...args),

    error: (message: string, ...args: any[]) =>
      logFunction('error', console.error, message, ...args)
  };
}

// Default logger configuration
const defaultConfig: LoggerConfig = {
  level: import.meta.env.NODE_ENV === 'development' ? 'debug' : 'error',
  enableTimestamp: import.meta.env.NODE_ENV === 'development',
  enableStackTrace: true,
  prefix: 'APP'
};

// Create default logger
export const logger = createLogger(defaultConfig);

// Create specialized loggers for different modules
export const createModuleLogger = (moduleName: string, config?: Partial<LoggerConfig>): Logger => {
  return createLogger({
    ...defaultConfig,
    ...config,
    prefix: moduleName
  });
};

// Performance logger for critical operations
export const perfLogger = createModuleLogger('PERF', {
  level: import.meta.env.NODE_ENV === 'development' ? 'info' : 'silent'
});

// Worker logger with specialized config
export const workerLogger = createModuleLogger('WORKER', {
  level: import.meta.env.NODE_ENV === 'development' ? 'debug' : 'warn'
});

// Auth logger for security-related logs
export const authLogger = createModuleLogger('AUTH', {
  level: 'info', // Always log auth events
  enableTimestamp: true
});

// Database logger
export const dbLogger = createModuleLogger('DB', {
  level: import.meta.env.NODE_ENV === 'development' ? 'debug' : 'error'
});

// Export types for external usage
export type { Logger, LoggerConfig, LogLevel };