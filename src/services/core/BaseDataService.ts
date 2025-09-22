import type { ApiResponse, PaginatedResponse } from '../../types';
import { logger } from '../../utils/logger';

// Base configuration for all data services
export interface ServiceConfig {
  name: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableLogging?: boolean;
}

// Standard filter interface for all services
export interface BaseFilter {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

// Standard CRUD operations interface
export interface CrudOperations<T, CreateData = Partial<T>, UpdateData = Partial<T>> {
  // Read operations
  getById(id: string): Promise<ApiResponse<T>>;
  getAll(filter?: BaseFilter): Promise<PaginatedResponse<T>>;
  search(query: string, filter?: BaseFilter): Promise<PaginatedResponse<T>>;

  // Write operations
  create(data: CreateData): Promise<ApiResponse<T>>;
  update(id: string, data: UpdateData): Promise<ApiResponse<T>>;
  delete(id: string): Promise<ApiResponse<boolean>>;

  // Batch operations
  createMany(data: CreateData[]): Promise<ApiResponse<T[]>>;
  updateMany(updates: Array<{ id: string; data: UpdateData }>): Promise<ApiResponse<T[]>>;
  deleteMany(ids: string[]): Promise<ApiResponse<boolean>>;
}

// Abstract base class for all data services
export abstract class BaseDataService<T, CreateData = Partial<T>, UpdateData = Partial<T>>
  implements CrudOperations<T, CreateData, UpdateData> {

  protected config: Required<ServiceConfig>;
  protected serviceName: string;

  constructor(config: ServiceConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableLogging: true,
      ...config
    };
    this.serviceName = config.name;
  }

  // Utility method for handling API responses
  protected async handleResponse<R>(
    operation: () => Promise<R>,
    operationName: string,
    metadata?: Record<string, unknown>
  ): Promise<R> {
    const startTime = performance.now();

    try {
      if (this.config.enableLogging) {
        logger.debug(`${this.serviceName}: Starting ${operationName}`, metadata);
      }

      const result = await this.retryOperation(operation);

      if (this.config.enableLogging) {
        const duration = performance.now() - startTime;
        logger.debug(`${this.serviceName}: Completed ${operationName}`, {
          ...metadata,
          duration: `${duration.toFixed(2)}ms`
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`${this.serviceName}: Failed ${operationName}`, {
        ...metadata,
        error,
        duration: `${duration.toFixed(2)}ms`
      });
      throw error;
    }
  }

  // Retry mechanism for failed operations
  protected async retryOperation<R>(
    operation: () => Promise<R>,
    attempt: number = 1
  ): Promise<R> {
    try {
      return await operation();
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`${this.serviceName}: Retrying operation (attempt ${attempt + 1}/${this.config.retryAttempts})`, {
          delay,
          error
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryOperation(operation, attempt + 1);
      }
      throw error;
    }
  }

  // Create standardized success response
  protected createSuccessResponse<R>(data: R): ApiResponse<R> {
    return {
      data,
      error: null,
      success: true
    };
  }

  // Create standardized error response
  protected createErrorResponse<R>(error: string | Error): ApiResponse<R> {
    const message = error instanceof Error ? error.message : error;
    return {
      data: null,
      error: message,
      success: false
    };
  }

  // Create paginated response
  protected createPaginatedResponse<R>(
    data: R[],
    pagination?: {
      page: number;
      limit: number;
      total: number;
    }
  ): PaginatedResponse<R> {
    return {
      data,
      error: null,
      success: true,
      pagination: pagination ? {
        ...pagination,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      } : undefined
    };
  }

  // Abstract methods that must be implemented by subclasses
  abstract getById(id: string): Promise<ApiResponse<T>>;
  abstract getAll(filter?: BaseFilter): Promise<PaginatedResponse<T>>;
  abstract search(query: string, filter?: BaseFilter): Promise<PaginatedResponse<T>>;
  abstract create(data: CreateData): Promise<ApiResponse<T>>;
  abstract update(id: string, data: UpdateData): Promise<ApiResponse<T>>;
  abstract delete(id: string): Promise<ApiResponse<boolean>>;

  // Default implementations for batch operations (can be overridden)
  async createMany(data: CreateData[]): Promise<ApiResponse<T[]>> {
    return this.handleResponse(async () => {
      const results: T[] = [];
      const errors: string[] = [];

      for (const item of data) {
        try {
          const result = await this.create(item);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(result.error || 'Unknown error');
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (errors.length > 0) {
        logger.warn(`${this.serviceName}: Batch create had ${errors.length} errors`, { errors });
      }

      return this.createSuccessResponse(results);
    }, 'createMany', { count: data.length });
  }

  async updateMany(updates: Array<{ id: string; data: UpdateData }>): Promise<ApiResponse<T[]>> {
    return this.handleResponse(async () => {
      const results: T[] = [];
      const errors: string[] = [];

      for (const { id, data } of updates) {
        try {
          const result = await this.update(id, data);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push(result.error || 'Unknown error');
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (errors.length > 0) {
        logger.warn(`${this.serviceName}: Batch update had ${errors.length} errors`, { errors });
      }

      return this.createSuccessResponse(results);
    }, 'updateMany', { count: updates.length });
  }

  async deleteMany(ids: string[]): Promise<ApiResponse<boolean>> {
    return this.handleResponse(async () => {
      let successCount = 0;
      const errors: string[] = [];

      for (const id of ids) {
        try {
          const result = await this.delete(id);
          if (result.success) {
            successCount++;
          } else {
            errors.push(result.error || 'Unknown error');
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }

      if (errors.length > 0) {
        logger.warn(`${this.serviceName}: Batch delete had ${errors.length} errors`, { errors });
      }

      return this.createSuccessResponse(successCount === ids.length);
    }, 'deleteMany', { count: ids.length });
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = performance.now();

    try {
      // Try a simple operation to check service health
      await this.getAll({ limit: 1 });
      const latency = performance.now() - startTime;

      return {
        healthy: true,
        latency
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get service metrics
  getMetrics(): {
    serviceName: string;
    config: ServiceConfig;
    uptime: number;
  } {
    return {
      serviceName: this.serviceName,
      config: this.config,
      uptime: performance.now()
    };
  }
}