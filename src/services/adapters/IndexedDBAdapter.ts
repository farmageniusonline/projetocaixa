import { BaseDataService, type BaseFilter, type ServiceConfig } from '../core/BaseDataService';
import type { ApiResponse, PaginatedResponse } from '../../types';
import { indexedDbService } from '../indexedDbService';
import { dbLogger } from '../../utils/logger';

// IndexedDB-specific filter extensions
export interface IndexedDBFilter extends BaseFilter {
  index?: string; // Which index to use for querying
  keyRange?: {
    lower?: unknown;
    upper?: unknown;
    lowerOpen?: boolean;
    upperOpen?: boolean;
  };
}

// Generic IndexedDB adapter
export class IndexedDBAdapter<T extends { id?: string | number }, CreateData = Omit<T, 'id'>, UpdateData = Partial<T>>
  extends BaseDataService<T, CreateData, UpdateData> {

  constructor(
    private storeName: string,
    config: Partial<ServiceConfig> = {}
  ) {
    super({
      name: `IndexedDB-${storeName}`,
      ...config
    });
  }

  async getById(id: string): Promise<ApiResponse<T>> {
    return this.handleResponse(async () => {
      try {
        const result = await indexedDbService.get(this.storeName, id);

        if (!result) {
          return this.createErrorResponse(`Item with id ${id} not found`);
        }

        return this.createSuccessResponse(result as T);
      } catch (error) {
        dbLogger.error(`Failed to get ${this.storeName} by id`, { id, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'getById', { id, store: this.storeName });
  }

  async getAll(filter: IndexedDBFilter = {}): Promise<PaginatedResponse<T>> {
    return this.handleResponse(async () => {
      try {
        let results = await indexedDbService.getAll(this.storeName) as T[];

        // Apply filters
        results = this.applyFilters(results, filter);

        // Apply sorting
        if (filter.sortBy) {
          results.sort((a, b) => {
            const aVal = (a as any)[filter.sortBy!];
            const bVal = (b as any)[filter.sortBy!];

            if (aVal < bVal) return filter.sortOrder === 'desc' ? 1 : -1;
            if (aVal > bVal) return filter.sortOrder === 'desc' ? -1 : 1;
            return 0;
          });
        }

        // Apply pagination
        const total = results.length;
        const offset = filter.offset || 0;
        const limit = filter.limit || total;

        const paginatedResults = results.slice(offset, offset + limit);

        const pagination = filter.limit ? {
          page: Math.floor(offset / limit) + 1,
          limit,
          total
        } : undefined;

        return this.createPaginatedResponse(paginatedResults, pagination);
      } catch (error) {
        dbLogger.error(`Failed to get all ${this.storeName}`, { filter, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'getAll', { filter, store: this.storeName });
  }

  async search(query: string, filter: IndexedDBFilter = {}): Promise<PaginatedResponse<T>> {
    return this.handleResponse(async () => {
      try {
        let results = await indexedDbService.getAll(this.storeName) as T[];

        // Apply text search
        if (query.trim()) {
          const searchTerm = query.toLowerCase();
          results = results.filter(item => {
            // Search in string fields
            return Object.values(item).some(value => {
              if (typeof value === 'string') {
                return value.toLowerCase().includes(searchTerm);
              }
              return false;
            });
          });
        }

        // Apply additional filters
        results = this.applyFilters(results, filter);

        // Apply sorting and pagination (same as getAll)
        if (filter.sortBy) {
          results.sort((a, b) => {
            const aVal = (a as any)[filter.sortBy!];
            const bVal = (b as any)[filter.sortBy!];

            if (aVal < bVal) return filter.sortOrder === 'desc' ? 1 : -1;
            if (aVal > bVal) return filter.sortOrder === 'desc' ? -1 : 1;
            return 0;
          });
        }

        const total = results.length;
        const offset = filter.offset || 0;
        const limit = filter.limit || total;

        const paginatedResults = results.slice(offset, offset + limit);

        const pagination = filter.limit ? {
          page: Math.floor(offset / limit) + 1,
          limit,
          total
        } : undefined;

        return this.createPaginatedResponse(paginatedResults, pagination);
      } catch (error) {
        dbLogger.error(`Failed to search ${this.storeName}`, { query, filter, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'search', { query, filter, store: this.storeName });
  }

  async create(data: CreateData): Promise<ApiResponse<T>> {
    return this.handleResponse(async () => {
      try {
        // Generate ID if not provided
        const id = this.generateId();
        const itemWithId = { ...data, id } as T;

        await indexedDbService.add(this.storeName, itemWithId);

        dbLogger.info(`Created ${this.storeName}`, { id });
        return this.createSuccessResponse(itemWithId);
      } catch (error) {
        dbLogger.error(`Failed to create ${this.storeName}`, { data, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'create', { store: this.storeName });
  }

  async update(id: string, data: UpdateData): Promise<ApiResponse<T>> {
    return this.handleResponse(async () => {
      try {
        // Get existing item
        const existing = await indexedDbService.get(this.storeName, id);
        if (!existing) {
          return this.createErrorResponse(`Item with id ${id} not found`);
        }

        // Merge updates
        const updated = { ...existing, ...data, id } as T;

        await indexedDbService.put(this.storeName, updated);

        dbLogger.info(`Updated ${this.storeName}`, { id });
        return this.createSuccessResponse(updated);
      } catch (error) {
        dbLogger.error(`Failed to update ${this.storeName}`, { id, data, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'update', { id, store: this.storeName });
  }

  async delete(id: string): Promise<ApiResponse<boolean>> {
    return this.handleResponse(async () => {
      try {
        await indexedDbService.delete(this.storeName, id);

        dbLogger.info(`Deleted ${this.storeName}`, { id });
        return this.createSuccessResponse(true);
      } catch (error) {
        dbLogger.error(`Failed to delete ${this.storeName}`, { id, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'delete', { id, store: this.storeName });
  }

  // IndexedDB-specific methods
  async clear(): Promise<ApiResponse<boolean>> {
    return this.handleResponse(async () => {
      try {
        await indexedDbService.clear(this.storeName);

        dbLogger.info(`Cleared ${this.storeName}`);
        return this.createSuccessResponse(true);
      } catch (error) {
        dbLogger.error(`Failed to clear ${this.storeName}`, { error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'clear', { store: this.storeName });
  }

  async count(): Promise<ApiResponse<number>> {
    return this.handleResponse(async () => {
      try {
        const count = await indexedDbService.count(this.storeName);
        return this.createSuccessResponse(count);
      } catch (error) {
        dbLogger.error(`Failed to count ${this.storeName}`, { error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'count', { store: this.storeName });
  }

  async getByIndex(indexName: string, key: unknown): Promise<ApiResponse<T[]>> {
    return this.handleResponse(async () => {
      try {
        const results = await indexedDbService.getByIndex(this.storeName, indexName, key) as T[];
        return this.createSuccessResponse(results);
      } catch (error) {
        dbLogger.error(`Failed to get ${this.storeName} by index`, { indexName, key, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'getByIndex', { indexName, key, store: this.storeName });
  }

  // Enhanced batch operations for IndexedDB
  async createMany(data: CreateData[]): Promise<ApiResponse<T[]>> {
    return this.handleResponse(async () => {
      try {
        const itemsWithIds = data.map(item => ({
          ...item,
          id: this.generateId()
        })) as T[];

        await indexedDbService.bulkAdd(this.storeName, itemsWithIds);

        dbLogger.info(`Bulk created ${this.storeName}`, { count: itemsWithIds.length });
        return this.createSuccessResponse(itemsWithIds);
      } catch (error) {
        dbLogger.error(`Failed to bulk create ${this.storeName}`, { count: data.length, error });
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'createMany', { count: data.length, store: this.storeName });
  }

  // Helper methods
  private applyFilters(results: T[], filter: IndexedDBFilter): T[] {
    let filtered = results;

    // Date range filtering
    if (filter.startDate || filter.endDate) {
      filtered = filtered.filter(item => {
        const itemDate = this.extractDate(item);
        if (!itemDate) return false;

        if (filter.startDate && itemDate < filter.startDate) return false;
        if (filter.endDate && itemDate > filter.endDate) return false;

        return true;
      });
    }

    return filtered;
  }

  private extractDate(item: T): string | null {
    // Try common date field names
    const dateFields = ['created_at', 'updated_at', 'date', 'timestamp'];

    for (const field of dateFields) {
      const value = (item as any)[field];
      if (value) {
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString();
      }
    }

    return null;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get storage info
  async getStorageInfo(): Promise<ApiResponse<{
    name: string;
    count: number;
    sizeEstimate?: number;
  }>> {
    return this.handleResponse(async () => {
      try {
        const count = await indexedDbService.count(this.storeName);

        // Estimate storage size (rough calculation)
        let sizeEstimate: number | undefined;
        if ('estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          sizeEstimate = estimate.usage;
        }

        return this.createSuccessResponse({
          name: this.storeName,
          count,
          sizeEstimate
        });
      } catch (error) {
        return this.createErrorResponse(error instanceof Error ? error.message : 'Unknown error');
      }
    }, 'getStorageInfo', { store: this.storeName });
  }
}