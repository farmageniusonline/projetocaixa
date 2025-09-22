import { BaseDataService, type BaseFilter, type ServiceConfig } from '../core/BaseDataService';
import type { ApiResponse, PaginatedResponse } from '../../types';
import { supabase } from '../../lib/supabase';
import { dbLogger } from '../../utils/logger';
import { sanitizeSupabasePayload, sanitizeApiResponse } from '../../utils/security-middleware';

// Supabase-specific filter extensions
export interface SupabaseFilter extends BaseFilter {
  select?: string;
  eq?: Record<string, unknown>;
  neq?: Record<string, unknown>;
  in?: Record<string, unknown[]>;
  contains?: Record<string, string>;
  ilike?: Record<string, string>;
}

// Generic Supabase adapter that can work with any table
export class SupabaseAdapter<T, CreateData = Partial<T>, UpdateData = Partial<T>>
  extends BaseDataService<T, CreateData, UpdateData> {

  constructor(
    private tableName: string,
    config: Partial<ServiceConfig> = {}
  ) {
    super({
      name: `Supabase-${tableName}`,
      ...config
    });
  }

  async getById(id: string): Promise<ApiResponse<T>> {
    return this.handleResponse(async () => {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        dbLogger.error(`Failed to get ${this.tableName} by id`, { id, error });
        return this.createErrorResponse(error.message);
      }

      return this.createSuccessResponse(data as T);
    }, 'getById', { id, table: this.tableName });
  }

  async getAll(filter: SupabaseFilter = {}): Promise<PaginatedResponse<T>> {
    return this.handleResponse(async () => {
      let query = supabase.from(this.tableName).select(filter.select || '*', { count: 'exact' });

      // Apply filters
      if (filter.eq) {
        Object.entries(filter.eq).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (filter.neq) {
        Object.entries(filter.neq).forEach(([key, value]) => {
          query = query.neq(key, value);
        });
      }

      if (filter.in) {
        Object.entries(filter.in).forEach(([key, values]) => {
          query = query.in(key, values);
        });
      }

      if (filter.contains) {
        Object.entries(filter.contains).forEach(([key, value]) => {
          query = query.contains(key, value);
        });
      }

      if (filter.ilike) {
        Object.entries(filter.ilike).forEach(([key, value]) => {
          query = query.ilike(key, value);
        });
      }

      // Date range filtering
      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate);
      }
      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate);
      }

      // Sorting
      if (filter.sortBy) {
        query = query.order(filter.sortBy, { ascending: filter.sortOrder !== 'desc' });
      }

      // Pagination
      if (filter.limit) {
        query = query.limit(filter.limit);
      }
      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        dbLogger.error(`Failed to get all ${this.tableName}`, { filter, error });
        return this.createErrorResponse(error.message);
      }

      const pagination = filter.limit ? {
        page: Math.floor((filter.offset || 0) / filter.limit) + 1,
        limit: filter.limit,
        total: count || 0
      } : undefined;

      return this.createPaginatedResponse(data as T[], pagination);
    }, 'getAll', { filter, table: this.tableName });
  }

  async search(query: string, filter: SupabaseFilter = {}): Promise<PaginatedResponse<T>> {
    return this.handleResponse(async () => {
      // Use text search if configured, otherwise fall back to simple search
      let searchQuery = supabase
        .from(this.tableName)
        .select(filter.select || '*', { count: 'exact' });

      // Apply search logic - this is generic and might need customization per table
      if (query.trim()) {
        // Try to search in common text fields
        searchQuery = searchQuery.or(
          `description.ilike.%${query}%,name.ilike.%${query}%,title.ilike.%${query}%`
        );
      }

      // Apply additional filters
      const { data, error, count } = await this.applyFiltersToQuery(searchQuery, filter);

      if (error) {
        dbLogger.error(`Failed to search ${this.tableName}`, { query, filter, error });
        return this.createErrorResponse(error.message);
      }

      const pagination = filter.limit ? {
        page: Math.floor((filter.offset || 0) / filter.limit) + 1,
        limit: filter.limit,
        total: count || 0
      } : undefined;

      return this.createPaginatedResponse(data as T[], pagination);
    }, 'search', { query, filter, table: this.tableName });
  }

  async create(data: CreateData): Promise<ApiResponse<T>> {
    return this.handleResponse(async () => {
      // Sanitize input data before database operation
      const sanitizedData = sanitizeSupabasePayload(data, this.tableName);

      const { data: result, error } = await supabase
        .from(this.tableName)
        .insert(sanitizedData as any)
        .select()
        .single();

      if (error) {
        dbLogger.error(`Failed to create ${this.tableName}`, { data: sanitizedData, error });
        return this.createErrorResponse(error.message);
      }

      dbLogger.info(`Created ${this.tableName}`, { id: (result as any)?.id });

      // Sanitize response data
      const sanitizedResult = sanitizeApiResponse(result);
      return this.createSuccessResponse(sanitizedResult as T);
    }, 'create', { table: this.tableName });
  }

  async update(id: string, data: UpdateData): Promise<ApiResponse<T>> {
    return this.handleResponse(async () => {
      // Sanitize input data before database operation
      const sanitizedData = sanitizeSupabasePayload(data, this.tableName);

      const { data: result, error } = await supabase
        .from(this.tableName)
        .update(sanitizedData as any)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        dbLogger.error(`Failed to update ${this.tableName}`, { id, data: sanitizedData, error });
        return this.createErrorResponse(error.message);
      }

      dbLogger.info(`Updated ${this.tableName}`, { id });

      // Sanitize response data
      const sanitizedResult = sanitizeApiResponse(result);
      return this.createSuccessResponse(sanitizedResult as T);
    }, 'update', { id, table: this.tableName });
  }

  async delete(id: string): Promise<ApiResponse<boolean>> {
    return this.handleResponse(async () => {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        dbLogger.error(`Failed to delete ${this.tableName}`, { id, error });
        return this.createErrorResponse(error.message);
      }

      dbLogger.info(`Deleted ${this.tableName}`, { id });
      return this.createSuccessResponse(true);
    }, 'delete', { id, table: this.tableName });
  }

  // Supabase-specific method for batch upsert
  async upsert(data: CreateData[]): Promise<ApiResponse<T[]>> {
    return this.handleResponse(async () => {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .upsert(data as any[])
        .select();

      if (error) {
        dbLogger.error(`Failed to upsert ${this.tableName}`, { count: data.length, error });
        return this.createErrorResponse(error.message);
      }

      dbLogger.info(`Upserted ${this.tableName}`, { count: result?.length });
      return this.createSuccessResponse(result as T[]);
    }, 'upsert', { count: data.length, table: this.tableName });
  }

  // Execute RPC functions
  async executeRpc<R = unknown>(
    functionName: string,
    params: Record<string, unknown> = {}
  ): Promise<ApiResponse<R>> {
    return this.handleResponse(async () => {
      const { data, error } = await supabase.rpc(functionName, params);

      if (error) {
        dbLogger.error(`Failed to execute RPC ${functionName}`, { params, error });
        return this.createErrorResponse(error.message);
      }

      return this.createSuccessResponse(data as R);
    }, 'executeRpc', { functionName, params });
  }

  // Helper method to apply filters to query
  private async applyFiltersToQuery(query: any, filter: SupabaseFilter) {
    // Apply sorting
    if (filter.sortBy) {
      query = query.order(filter.sortBy, { ascending: filter.sortOrder !== 'desc' });
    }

    // Apply pagination
    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    if (filter.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
    }

    return await query;
  }

  // Get table schema info
  async getSchema(): Promise<ApiResponse<unknown>> {
    return this.handleResponse(async () => {
      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', this.tableName);

      if (error) {
        return this.createErrorResponse(error.message);
      }

      return this.createSuccessResponse(data);
    }, 'getSchema', { table: this.tableName });
  }

  // Check if table exists and is accessible
  async checkTableAccess(): Promise<{ exists: boolean; accessible: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116') { // Table not found
          return { exists: false, accessible: false, error: 'Table not found' };
        }
        return { exists: true, accessible: false, error: error.message };
      }

      return { exists: true, accessible: true };
    } catch (error) {
      return {
        exists: false,
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}