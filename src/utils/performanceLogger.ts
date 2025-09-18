export interface PerformanceMetric {
  id: string;
  operation: OperationType;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export type OperationType =
  | 'excel_parse'
  | 'excel_filter'
  | 'conference_search'
  | 'conference_transfer'
  | 'manual_entry_save'
  | 'data_export'
  | 'cache_operations';

export interface PerformanceStats {
  operation: OperationType;
  count: number;
  average: number;
  median: number;
  p95: number;
  min: number;
  max: number;
  totalTime: number;
}

class PerformanceLogger {
  private isEnabled: boolean = false;
  private activeOperations: Map<string, { operation: OperationType; startTime: number; metadata?: Record<string, any> }> = new Map();
  private dbName = 'performance_metrics';
  private dbVersion = 1;
  private storeName = 'metrics';

  constructor() {
    // Check if performance logging is enabled (opt-in)
    this.isEnabled = localStorage.getItem('performance_logging_enabled') === 'true';

    if (this.isEnabled) {
      this.initDatabase();
      this.cleanOldMetrics();
    }
  }

  // Enable/disable performance logging
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('performance_logging_enabled', enabled.toString());

    if (enabled) {
      this.initDatabase();
    }
  }

  public isLoggingEnabled(): boolean {
    return this.isEnabled;
  }

  // Start timing an operation
  public startOperation(operation: OperationType, metadata?: Record<string, any>): string {
    if (!this.isEnabled) return '';

    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    this.activeOperations.set(operationId, {
      operation,
      startTime,
      metadata
    });

    return operationId;
  }

  // End timing an operation
  public endOperation(operationId: string): PerformanceMetric | null {
    if (!this.isEnabled || !operationId) return null;

    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) return null;

    const endTime = performance.now();
    const duration = endTime - activeOp.startTime;

    const metric: PerformanceMetric = {
      id: operationId,
      operation: activeOp.operation,
      startTime: activeOp.startTime,
      endTime,
      duration,
      metadata: activeOp.metadata,
      timestamp: new Date()
    };

    this.activeOperations.delete(operationId);
    this.saveMetric(metric);

    return metric;
  }

  // Measure a synchronous operation
  public measureSync<T>(operation: OperationType, fn: () => T, metadata?: Record<string, any>): T {
    if (!this.isEnabled) return fn();

    const operationId = this.startOperation(operation, metadata);
    try {
      const result = fn();
      this.endOperation(operationId);
      return result;
    } catch (error) {
      this.endOperation(operationId);
      throw error;
    }
  }

  // Measure an asynchronous operation
  public async measureAsync<T>(operation: OperationType, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    if (!this.isEnabled) return fn();

    const operationId = this.startOperation(operation, metadata);
    try {
      const result = await fn();
      this.endOperation(operationId);
      return result;
    } catch (error) {
      this.endOperation(operationId);
      throw error;
    }
  }

  // Get performance statistics for today
  public async getTodaysStats(): Promise<PerformanceStats[]> {
    if (!this.isEnabled) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const metrics = await this.getMetricsByDateRange(today, tomorrow);
    return this.calculateStats(metrics);
  }

  // Get performance statistics for a specific operation
  public async getOperationStats(operation: OperationType, hours: number = 24): Promise<PerformanceStats | null> {
    if (!this.isEnabled) return null;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const metrics = await this.getMetricsByDateRange(since, new Date());
    const operationMetrics = metrics.filter(m => m.operation === operation);

    if (operationMetrics.length === 0) return null;

    const stats = this.calculateStats(operationMetrics);
    return stats.find(s => s.operation === operation) || null;
  }

  // Get all metrics for a date range
  public async getMetricsByDateRange(start: Date, end: Date): Promise<PerformanceMetric[]> {
    if (!this.isEnabled) return [];

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('timestamp');

        const range = IDBKeyRange.bound(start, end);
        const request = index.getAll(range);

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Calculate statistics from metrics
  private calculateStats(metrics: PerformanceMetric[]): PerformanceStats[] {
    const operationGroups = new Map<OperationType, PerformanceMetric[]>();

    // Group metrics by operation type
    metrics.forEach(metric => {
      if (!operationGroups.has(metric.operation)) {
        operationGroups.set(metric.operation, []);
      }
      operationGroups.get(metric.operation)!.push(metric);
    });

    const stats: PerformanceStats[] = [];

    operationGroups.forEach((operationMetrics, operation) => {
      const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
      const count = durations.length;
      const totalTime = durations.reduce((sum, d) => sum + d, 0);
      const average = totalTime / count;
      const median = durations[Math.floor(count / 2)];
      const p95Index = Math.floor(count * 0.95);
      const p95 = durations[p95Index] || durations[count - 1];
      const min = durations[0];
      const max = durations[count - 1];

      stats.push({
        operation,
        count,
        average,
        median,
        p95,
        min,
        max,
        totalTime
      });
    });

    return stats.sort((a, b) => b.average - a.average);
  }

  // Initialize IndexedDB database
  private initDatabase(): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(this.storeName)) {
        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('operation', 'operation', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onerror = () => {
      console.error('Failed to initialize performance metrics database:', request.error);
    };
  }

  // Save a metric to IndexedDB
  private saveMetric(metric: PerformanceMetric): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      store.add(metric);

      transaction.onerror = () => {
        console.error('Failed to save performance metric:', transaction.error);
      };
    };

    request.onerror = () => {
      console.error('Failed to open performance metrics database:', request.error);
    };
  }

  // Clean up metrics older than 24 hours
  private cleanOldMetrics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');

      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.onerror = () => {
        console.error('Failed to clean old performance metrics:', transaction.error);
      };
    };

    request.onerror = () => {
      console.error('Failed to open performance metrics database for cleanup:', request.error);
    };
  }

  // Export all current metrics (for debugging)
  public async exportMetrics(): Promise<PerformanceMetric[]> {
    if (!this.isEnabled) return [];

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.getMetricsByDateRange(twentyFourHoursAgo, new Date());
  }

  // Clear all metrics
  public async clearAllMetrics(): Promise<void> {
    if (!this.isEnabled) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
          resolve();
        };

        clearRequest.onerror = () => {
          reject(clearRequest.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Singleton instance
export const performanceLogger = new PerformanceLogger();

// Utility functions for common usage patterns
export const measureTime = performanceLogger.measureSync.bind(performanceLogger);
export const measureTimeAsync = performanceLogger.measureAsync.bind(performanceLogger);
export const startTiming = performanceLogger.startOperation.bind(performanceLogger);
export const endTiming = performanceLogger.endOperation.bind(performanceLogger);