import type { BaseDataService } from './BaseDataService';
import { SupabaseAdapter } from '../adapters/SupabaseAdapter';
import { IndexedDBAdapter } from '../adapters/IndexedDBAdapter';
import { logger } from '../../utils/logger';

// Service registry for managing all data services
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, BaseDataService<any>>();
  private healthCheckInterval?: number;

  private constructor() {
    // Start health monitoring
    this.startHealthMonitoring();
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  // Register a service
  registerService<T>(name: string, service: BaseDataService<T>): void {
    this.services.set(name, service);
    logger.info('Service registered', { serviceName: name });
  }

  // Get a service by name
  getService<T>(name: string): BaseDataService<T> | undefined {
    return this.services.get(name) as BaseDataService<T>;
  }

  // Create and register a Supabase service
  createSupabaseService<T>(name: string, tableName: string): SupabaseAdapter<T> {
    const service = new SupabaseAdapter<T>(tableName, {
      name: `${name}-supabase`,
      enableLogging: true
    });

    this.registerService(name, service);
    return service;
  }

  // Create and register an IndexedDB service
  createIndexedDBService<T extends { id?: string | number }>(
    name: string,
    storeName: string
  ): IndexedDBAdapter<T> {
    const service = new IndexedDBAdapter<T>(storeName, {
      name: `${name}-indexeddb`,
      enableLogging: true
    });

    this.registerService(name, service);
    return service;
  }

  // Get all registered services
  getAllServices(): Array<{ name: string; service: BaseDataService<any> }> {
    return Array.from(this.services.entries()).map(([name, service]) => ({
      name,
      service
    }));
  }

  // Remove a service
  unregisterService(name: string): boolean {
    const removed = this.services.delete(name);
    if (removed) {
      logger.info('Service unregistered', { serviceName: name });
    }
    return removed;
  }

  // Health check all services
  async checkAllServices(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const [name, service] of this.services) {
      try {
        const health = await service.healthCheck();
        results[name] = {
          ...health,
          metrics: service.getMetrics()
        };
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return results;
  }

  // Start periodic health monitoring
  private startHealthMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = window.setInterval(async () => {
      const health = await this.checkAllServices();
      const unhealthyServices = Object.entries(health)
        .filter(([, status]) => !status.healthy)
        .map(([name]) => name);

      if (unhealthyServices.length > 0) {
        logger.warn('Unhealthy services detected', {
          unhealthyServices,
          totalServices: this.services.size
        });
      }
    }, intervalMs);
  }

  // Stop health monitoring
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // Cleanup all services
  destroy(): void {
    this.stopHealthMonitoring();
    this.services.clear();
    logger.info('Service registry destroyed');
  }
}

// Create global instance
export const serviceRegistry = ServiceRegistry.getInstance();

// Convenience functions for common service patterns
export function createBankingService() {
  return serviceRegistry.createSupabaseService('banking', 'bank_entries');
}

export function createConferenceService() {
  return serviceRegistry.createSupabaseService('conference', 'cash_conferences');
}

export function createNotFoundService() {
  return serviceRegistry.createSupabaseService('notFound', 'not_found_history');
}

export function createLocalBankingService() {
  return serviceRegistry.createIndexedDBService('localBanking', 'bankEntries');
}

export function createLocalConferenceService() {
  return serviceRegistry.createIndexedDBService('localConference', 'conferenceEntries');
}

// Service factory with automatic fallback
export function createHybridService<T>(
  name: string,
  supabaseTable: string,
  indexedDBStore: string,
  preferLocal: boolean = false
) {
  const primaryService = preferLocal
    ? serviceRegistry.createIndexedDBService<T>(name, indexedDBStore)
    : serviceRegistry.createSupabaseService<T>(name, supabaseTable);

  const fallbackService = preferLocal
    ? serviceRegistry.createSupabaseService<T>(`${name}-fallback`, supabaseTable)
    : serviceRegistry.createIndexedDBService<T>(`${name}-fallback`, indexedDBStore);

  // Register both services
  serviceRegistry.registerService(`${name}-primary`, primaryService);
  serviceRegistry.registerService(`${name}-fallback`, fallbackService);

  return {
    primary: primaryService,
    fallback: fallbackService
  };
}

// Initialize common services
export function initializeServices() {
  logger.info('Initializing application services...');

  try {
    // Create main data services
    createBankingService();
    createConferenceService();
    createNotFoundService();

    // Create local backup services
    createLocalBankingService();
    createLocalConferenceService();

    logger.info('Services initialized successfully', {
      servicesCount: serviceRegistry.getAllServices().length
    });
  } catch (error) {
    logger.error('Failed to initialize services', { error });
    throw error;
  }
}