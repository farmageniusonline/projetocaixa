/**
 * Hook for consistent loading state management with skeleton loaders
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../utils/logger';

const loadingLogger = logger.createModule('LOADING');

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  startTime: number | null;
  duration: number;
}

export interface LoadingStateOptions {
  minLoadingTime?: number; // Minimum time to show loading (prevents flashing)
  timeout?: number; // Maximum time before considering it failed
  retryCount?: number; // Number of automatic retries
  onStart?: () => void;
  onSuccess?: (duration: number) => void;
  onError?: (error: string, attempt: number) => void;
  onComplete?: (success: boolean, duration: number) => void;
}

export interface UseLoadingStateReturn {
  state: LoadingState;
  startLoading: () => void;
  stopLoading: (error?: string) => void;
  executeWithLoading: <T>(
    operation: () => Promise<T>,
    options?: { onSuccess?: (result: T) => void; onError?: (error: Error) => void }
  ) => Promise<T | null>;
  reset: () => void;
  isMinTimeElapsed: boolean;
}

/**
 * Hook for managing loading states with built-in timing, retries, and callbacks
 */
export function useLoadingState(options: LoadingStateOptions = {}): UseLoadingStateReturn {
  const {
    minLoadingTime = 300, // 300ms minimum to prevent flashing
    timeout = 30000, // 30 seconds timeout
    retryCount = 0,
    onStart,
    onSuccess,
    onError,
    onComplete
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    startTime: null,
    duration: 0
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const minTimeRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (minTimeRef.current) {
        clearTimeout(minTimeRef.current);
      }
    };
  }, []);

  const startLoading = useCallback(() => {
    const startTime = Date.now();

    setState({
      isLoading: true,
      error: null,
      startTime,
      duration: 0
    });

    setIsMinTimeElapsed(false);
    retryCountRef.current = 0;

    // Set minimum time flag
    minTimeRef.current = setTimeout(() => {
      setIsMinTimeElapsed(true);
    }, minLoadingTime);

    // Set timeout for maximum loading time
    if (timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        const duration = Date.now() - startTime;
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Operação demorou muito para responder',
          duration
        }));

        loadingLogger.warn('Loading timeout exceeded', { duration, timeout });
        onError?.('Timeout', 0);
        onComplete?.(false, duration);
      }, timeout);
    }

    loadingLogger.debug('Loading started', { startTime, timeout, minLoadingTime });
    onStart?.();
  }, [minLoadingTime, timeout, onStart, onError, onComplete]);

  const stopLoading = useCallback((error?: string) => {
    const now = Date.now();

    setState(prev => {
      const duration = prev.startTime ? now - prev.startTime : 0;
      const newState = {
        ...prev,
        isLoading: false,
        error: error || null,
        duration
      };

      // Call completion callbacks
      if (error) {
        loadingLogger.warn('Loading completed with error', { error, duration });
        onError?.(error, retryCountRef.current);
      } else {
        loadingLogger.debug('Loading completed successfully', { duration });
        onSuccess?.(duration);
      }

      onComplete?.(!error, duration);
      return newState;
    });

    // Clear timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (minTimeRef.current) {
      clearTimeout(minTimeRef.current);
      minTimeRef.current = undefined;
    }

    setIsMinTimeElapsed(true);
  }, [onSuccess, onError, onComplete]);

  const executeWithLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    operationOptions: { onSuccess?: (result: T) => void; onError?: (error: Error) => void } = {}
  ): Promise<T | null> => {
    const { onSuccess: onOpSuccess, onError: onOpError } = operationOptions;

    startLoading();

    try {
      const result = await operation();

      // Ensure minimum loading time has passed
      if (!isMinTimeElapsed) {
        await new Promise(resolve => {
          const checkTime = () => {
            if (isMinTimeElapsed) {
              resolve(void 0);
            } else {
              setTimeout(checkTime, 50);
            }
          };
          checkTime();
        });
      }

      stopLoading();
      onOpSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      // Retry logic
      if (retryCountRef.current < retryCount) {
        retryCountRef.current++;
        loadingLogger.info('Retrying operation', {
          attempt: retryCountRef.current,
          maxRetries: retryCount,
          error: errorMessage
        });

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));

        return executeWithLoading(operation, operationOptions);
      }

      stopLoading(errorMessage);
      onOpError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    }
  }, [startLoading, stopLoading, isMinTimeElapsed, retryCount]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      startTime: null,
      duration: 0
    });

    setIsMinTimeElapsed(false);
    retryCountRef.current = 0;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (minTimeRef.current) {
      clearTimeout(minTimeRef.current);
      minTimeRef.current = undefined;
    }

    loadingLogger.debug('Loading state reset');
  }, []);

  return {
    state,
    startLoading,
    stopLoading,
    executeWithLoading,
    reset,
    isMinTimeElapsed
  };
}

/**
 * Hook for managing multiple loading states
 */
export function useMultipleLoadingStates<T extends string>(
  keys: T[],
  globalOptions: LoadingStateOptions = {}
): Record<T, UseLoadingStateReturn> & {
  isAnyLoading: boolean;
  hasAnyError: boolean;
  resetAll: () => void;
} {
  const loadingStates = {} as Record<T, UseLoadingStateReturn>;

  // Create individual loading states
  keys.forEach(key => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    loadingStates[key] = useLoadingState(globalOptions);
  });

  const isAnyLoading = keys.some(key => loadingStates[key].state.isLoading);
  const hasAnyError = keys.some(key => loadingStates[key].state.error !== null);

  const resetAll = useCallback(() => {
    keys.forEach(key => {
      loadingStates[key].reset();
    });
  }, [keys, loadingStates]);

  return {
    ...loadingStates,
    isAnyLoading,
    hasAnyError,
    resetAll
  };
}

/**
 * Hook for paginated loading states
 */
export function usePaginatedLoading(options: LoadingStateOptions = {}) {
  const mainLoading = useLoadingState(options);
  const moreLoading = useLoadingState({ ...options, minLoadingTime: 100 });

  const loadMore = useCallback(async <T>(
    operation: () => Promise<T[]>,
    onSuccess?: (newItems: T[]) => void
  ) => {
    return moreLoading.executeWithLoading(async () => {
      const newItems = await operation();
      onSuccess?.(newItems);
      return newItems;
    });
  }, [moreLoading]);

  const refresh = useCallback(async <T>(
    operation: () => Promise<T[]>,
    onSuccess?: (items: T[]) => void
  ) => {
    return mainLoading.executeWithLoading(async () => {
      const items = await operation();
      onSuccess?.(items);
      return items;
    });
  }, [mainLoading]);

  return {
    mainLoading: mainLoading.state,
    moreLoading: moreLoading.state,
    isAnyLoading: mainLoading.state.isLoading || moreLoading.state.isLoading,
    loadMore,
    refresh,
    reset: () => {
      mainLoading.reset();
      moreLoading.reset();
    }
  };
}

/**
 * Hook for file upload loading with progress
 */
export function useUploadLoading(options: LoadingStateOptions = {}) {
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);

  const loading = useLoadingState({
    ...options,
    onStart: () => {
      setProgress(0);
      setUploadSpeed(0);
      setEstimatedTimeRemaining(0);
      options.onStart?.();
    },
    onComplete: (success, duration) => {
      if (success) {
        setProgress(100);
      }
      options.onComplete?.(success, duration);
    }
  });

  const updateProgress = useCallback((
    loaded: number,
    total: number,
    startTime: number = Date.now()
  ) => {
    const newProgress = Math.round((loaded / total) * 100);
    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const speed = loaded / elapsed; // bytes per second
    const remaining = (total - loaded) / speed; // seconds

    setProgress(newProgress);
    setUploadSpeed(speed);
    setEstimatedTimeRemaining(remaining);
  }, []);

  const uploadWithProgress = useCallback(async <T>(
    operation: (onProgress: (loaded: number, total: number) => void) => Promise<T>
  ): Promise<T | null> => {
    const startTime = Date.now();

    return loading.executeWithLoading(() =>
      operation((loaded, total) => updateProgress(loaded, total, startTime))
    );
  }, [loading, updateProgress]);

  return {
    ...loading,
    progress,
    uploadSpeed,
    estimatedTimeRemaining,
    updateProgress,
    uploadWithProgress
  };
}

export default useLoadingState;