import { logger } from '../utils/logger';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

interface CacheConfig {
  defaultTTL: number; // milliseconds
  maxSize: number; // max items
  version: string; // cache version for invalidation
}

export class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      version: '1.0.0',
      ...config
    };

    // Clean expired items periodically
    setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Remove oldest items if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      version: this.config.version
    });

    logger.debug('Cache: Item stored', { key, ttl: ttl || this.config.defaultTTL });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      logger.debug('Cache: Miss', { key });
      return null;
    }

    // Check version compatibility
    if (item.version !== this.config.version) {
      this.cache.delete(key);
      logger.debug('Cache: Version mismatch, invalidated', { key });
      return null;
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      logger.debug('Cache: Expired', { key });
      return null;
    }

    logger.debug('Cache: Hit', { key });
    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    return item !== undefined &&
           item.version === this.config.version &&
           Date.now() - item.timestamp <= item.ttl;
  }

  delete(key: string): void {
    this.cache.delete(key);
    logger.debug('Cache: Item deleted', { key });
  }

  clear(): void {
    this.cache.clear();
    logger.info('Cache: All items cleared');
  }

  // Pattern-based invalidation
  invalidatePattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    logger.info('Cache: Pattern invalidation completed', { pattern: pattern.toString(), invalidated });
    return invalidated;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    let valid = 0;

    for (const item of this.cache.values()) {
      if (now - item.timestamp > item.ttl || item.version !== this.config.version) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      hitRatio: valid / (valid + expired) || 0,
      maxSize: this.config.maxSize,
      usage: this.cache.size / this.config.maxSize
    };
  }

  // Clean expired items
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl || item.version !== this.config.version) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache: Cleanup completed', { cleaned });
    }
  }

  // Update cache version (invalidates all items)
  updateVersion(newVersion: string): void {
    this.config.version = newVersion;
    this.clear(); // Clear all items with old version
    logger.info('Cache: Version updated', { newVersion });
  }

  // Cache configuration updates
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Cache: Configuration updated', { config: this.config });
  }

  // Memory usage estimation (rough)
  getMemoryUsage(): { estimatedBytes: number; itemCount: number } {
    let estimatedBytes = 0;

    for (const [key, item] of this.cache.entries()) {
      // Rough estimation: key size + JSON stringified data size + metadata
      estimatedBytes += key.length * 2; // Rough UTF-16 size
      estimatedBytes += JSON.stringify(item.data).length * 2;
      estimatedBytes += 100; // Metadata overhead
    }

    return {
      estimatedBytes,
      itemCount: this.cache.size
    };
  }

  // Export cache contents for debugging
  exportCache(): Record<string, any> {
    const exports: Record<string, any> = {};

    for (const [key, item] of this.cache.entries()) {
      exports[key] = {
        data: item.data,
        timestamp: item.timestamp,
        ttl: item.ttl,
        version: item.version,
        age: Date.now() - item.timestamp,
        expired: Date.now() - item.timestamp > item.ttl
      };
    }

    return exports;
  }
}

// Singleton instance
export const cacheService = new CacheService();

// High-level cache decorators
export function cached<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cacheService.get(key);

    if (cached !== null) {
      return cached;
    }

    const result = fn(...args);
    cacheService.set(key, result, ttl);
    return result;
  }) as T;
}

export function cachedAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cacheService.get(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    cacheService.set(key, result, ttl);
    return result;
  }) as T;
}

// Specialized cache instances for different purposes
export const queryCache = new CacheService({
  defaultTTL: 2 * 60 * 1000, // 2 minutes for queries
  maxSize: 50,
  version: 'query-v1'
});

export const fileCache = new CacheService({
  defaultTTL: 10 * 60 * 1000, // 10 minutes for file operations
  maxSize: 20,
  version: 'file-v1'
});

export const userDataCache = new CacheService({
  defaultTTL: 30 * 60 * 1000, // 30 minutes for user data
  maxSize: 30,
  version: 'user-v1'
});