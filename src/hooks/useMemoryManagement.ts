import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

// Memory management utilities
export interface MemoryMonitor {
  checkMemoryUsage: () => MemoryInfo | null;
  scheduleCleanup: (callback: () => void, delay?: number) => number;
  cancelCleanup: (id: number) => void;
  forceGarbageCollection: () => void;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
}

// Hook for automatic cleanup of event listeners
export function useEventListener<T extends Event>(
  eventName: string,
  handler: (event: T) => void,
  element: EventTarget | null = window,
  options?: AddEventListenerOptions
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element) return;

    const eventListener = (event: Event) => savedHandler.current(event as T);

    element.addEventListener(eventName, eventListener, options);

    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

// Hook for managing AbortController
export function useAbortController() {
  const controllerRef = useRef<AbortController>();

  const createController = useCallback(() => {
    // Abort previous controller if exists
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();
    return controllerRef.current;
  }, []);

  const abort = useCallback((reason?: string) => {
    if (controllerRef.current) {
      controllerRef.current.abort(reason);
      controllerRef.current = undefined;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abort('Component unmounted');
    };
  }, [abort]);

  return {
    signal: controllerRef.current?.signal,
    createController,
    abort
  };
}

// Hook for memory monitoring
export function useMemoryMonitor(): MemoryMonitor {
  const cleanupTimers = useRef<Set<number>>(new Set());

  const checkMemoryUsage = useCallback((): MemoryInfo | null => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }, []);

  const scheduleCleanup = useCallback((callback: () => void, delay: number = 5000): number => {
    const id = window.setTimeout(() => {
      cleanupTimers.current.delete(id);
      callback();
    }, delay);

    cleanupTimers.current.add(id);
    return id;
  }, []);

  const cancelCleanup = useCallback((id: number) => {
    window.clearTimeout(id);
    cleanupTimers.current.delete(id);
  }, []);

  const forceGarbageCollection = useCallback(() => {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      logger.debug('Manual garbage collection triggered');
    } else {
      // Force garbage collection by creating memory pressure
      const memoryPressure = new Array(1000000).fill(0);
      memoryPressure.length = 0;
      logger.debug('Memory pressure created for garbage collection');
    }
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      cleanupTimers.current.forEach(id => window.clearTimeout(id));
      cleanupTimers.current.clear();
    };
  }, []);

  return {
    checkMemoryUsage,
    scheduleCleanup,
    cancelCleanup,
    forceGarbageCollection
  };
}

// Hook for managing large data sets with cleanup
export function useLargeDataset<T>(
  initialData: T[] = [],
  options: {
    maxSize?: number;
    cleanupThreshold?: number;
    autoCleanup?: boolean;
  } = {}
) {
  const {
    maxSize = 10000,
    cleanupThreshold = 8000,
    autoCleanup = true
  } = options;

  const dataRef = useRef<T[]>(initialData);
  const memoryMonitor = useMemoryMonitor();

  const addItems = useCallback((items: T[]) => {
    const newData = [...dataRef.current, ...items];

    // Check if we need cleanup
    if (autoCleanup && newData.length > cleanupThreshold) {
      // Keep only the most recent items
      const keepCount = Math.floor(maxSize * 0.7); // Keep 70% of max size
      dataRef.current = newData.slice(-keepCount);

      // Schedule garbage collection
      memoryMonitor.scheduleCleanup(() => {
        memoryMonitor.forceGarbageCollection();
      }, 1000);

      logger.debug('Dataset cleanup performed', {
        originalSize: newData.length,
        newSize: dataRef.current.length,
        itemsRemoved: newData.length - dataRef.current.length
      });
    } else {
      dataRef.current = newData;
    }
  }, [maxSize, cleanupThreshold, autoCleanup, memoryMonitor]);

  const clearData = useCallback(() => {
    dataRef.current = [];
    memoryMonitor.scheduleCleanup(() => {
      memoryMonitor.forceGarbageCollection();
    }, 100);
  }, [memoryMonitor]);

  const getData = useCallback(() => dataRef.current, []);

  const getSize = useCallback(() => dataRef.current.length, []);

  return {
    addItems,
    clearData,
    getData,
    getSize
  };
}

// Hook for managing WebWorker lifecycle
export function useWebWorkerMemory(workerFactory: () => Worker) {
  const workerRef = useRef<Worker>();
  const { abort, createController } = useAbortController();

  const createWorker = useCallback(() => {
    // Terminate existing worker
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    workerRef.current = workerFactory();
    createController(); // Create new abort controller

    return workerRef.current;
  }, [workerFactory, createController]);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = undefined;
    }
    abort('Worker terminated manually');
  }, [abort]);

  // Auto-terminate on unmount
  useEffect(() => {
    return () => {
      terminateWorker();
    };
  }, [terminateWorker]);

  return {
    worker: workerRef.current,
    createWorker,
    terminateWorker
  };
}

// Hook for periodic memory monitoring
export function useMemoryWatcher(
  threshold: number = 80, // Memory usage percentage threshold
  checkInterval: number = 30000 // Check every 30 seconds
) {
  const memoryMonitor = useMemoryMonitor();
  const warningShown = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const memoryInfo = memoryMonitor.checkMemoryUsage();

      if (memoryInfo && memoryInfo.usagePercentage > threshold) {
        if (!warningShown.current) {
          logger.warn('High memory usage detected', {
            usage: `${memoryInfo.usagePercentage.toFixed(1)}%`,
            used: `${(memoryInfo.usedJSHeapSize / 1048576).toFixed(1)}MB`,
            limit: `${(memoryInfo.jsHeapSizeLimit / 1048576).toFixed(1)}MB`
          });
          warningShown.current = true;

          // Schedule garbage collection
          memoryMonitor.scheduleCleanup(() => {
            memoryMonitor.forceGarbageCollection();
            warningShown.current = false; // Reset warning flag after cleanup
          }, 2000);
        }
      } else {
        warningShown.current = false;
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }, [threshold, checkInterval, memoryMonitor]);
}