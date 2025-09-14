interface CacheItem<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  expiresAt?: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number; // Time to live in milliseconds
  enableCompression: boolean;
  evictionStrategy: 'LRU' | 'LFU' | 'TTL';
}

class SmartCache {
  private cache: Map<string, CacheItem<any>>;
  private config: CacheConfig;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 100,
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      enableCompression: config.enableCompression || false,
      evictionStrategy: config.evictionStrategy || 'LRU'
    };
    this.cache = new Map();
    this.startCleanupInterval();
  }

  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = ttl ? now + ttl : now + this.config.defaultTTL;

    // If cache is at max size, evict based on strategy
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    const compressedData = this.config.enableCompression ? this.compress(value) : value;

    this.cache.set(key, {
      data: compressedData,
      timestamp: now,
      accessCount: 0,
      lastAccess: now,
      expiresAt
    });
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.missCount++;
      return null;
    }

    const now = Date.now();

    // Check if item has expired
    if (item.expiresAt && now > item.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update access statistics
    item.accessCount++;
    item.lastAccess = now;
    this.hitCount++;

    return this.config.enableCompression ? this.decompress(item.data) : item.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const now = Date.now();
    if (item.expiresAt && now > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get/Set pattern with automatic caching
   */
  async getOrSet<T>(key: string, factory: () => Promise<T> | T, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let invalidated = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  }

  /**
   * Evict items based on configured strategy
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string;

    switch (this.config.evictionStrategy) {
      case 'LRU':
        keyToEvict = this.findLRUKey();
        break;
      case 'LFU':
        keyToEvict = this.findLFUKey();
        break;
      case 'TTL':
        keyToEvict = this.findNearestExpiring();
        break;
      default:
        keyToEvict = this.cache.keys().next().value;
    }

    this.cache.delete(keyToEvict);
  }

  private findLRUKey(): string {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findLFUKey(): string {
    let leastUsedKey = '';
    let leastCount = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.accessCount < leastCount) {
        leastCount = item.accessCount;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  private findNearestExpiring(): string {
    let nearestKey = '';
    let nearestExpiry = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < nearestExpiry) {
        nearestExpiry = item.expiresAt;
        nearestKey = key;
      }
    }

    return nearestKey || this.cache.keys().next().value;
  }

  private compress<T>(data: T): string {
    try {
      return JSON.stringify(data);
    } catch {
      return data as any;
    }
  }

  private decompress<T>(data: string): T {
    try {
      return JSON.parse(data);
    } catch {
      return data as any;
    }
  }

  private getMemoryUsage(): number {
    let size = 0;
    for (const item of this.cache.values()) {
      size += JSON.stringify(item).length;
    }
    return size;
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Cleanup every minute
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance for the application
export const appCache = new SmartCache({
  maxSize: 200,
  defaultTTL: 300000, // 5 minutes
  enableCompression: true,
  evictionStrategy: 'LRU'
});

// Specific cache for frequently accessed data
export const dataCache = new SmartCache({
  maxSize: 50,
  defaultTTL: 600000, // 10 minutes
  enableCompression: false,
  evictionStrategy: 'LFU'
});

export default SmartCache;