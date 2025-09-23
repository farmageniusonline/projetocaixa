import { useRef, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { WorkerAPI, ProcessedExcelData, BankEntryForProcessing } from '../workers/excelProcessor.worker';
import { syncExcelProcessor } from '../utils/syncExcelProcessor';
import { logger } from '../utils/logger';

export interface ProcessFileOptions {
  signal?: AbortSignal;
  timeout?: number;
}

export function useExcelWorker() {
  const workerRef = useRef<Worker | null>(null);
  const workerApiRef = useRef<Comlink.Remote<WorkerAPI> | null>(null);

  const initWorker = useCallback(async () => {
    if (!workerRef.current) {
      logger.debug('🔧 Hook: Inicializando Web Worker...');
      try {
        // Create worker from the TypeScript file (Vite will handle compilation)
        const worker = new Worker(
          new URL('../workers/excelProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onerror = (error) => {
          logger.error('❌ Hook: Erro no worker:', error);
        };

        worker.onmessageerror = (error) => {
          logger.error('❌ Hook: Erro de mensagem no worker:', error);
        };

        workerRef.current = worker;
        workerApiRef.current = Comlink.wrap<WorkerAPI>(worker);
        logger.debug('✅ Hook: Worker inicializado com sucesso');
      } catch (error) {
        logger.error('❌ Hook: Falha ao inicializar worker:', error);
        throw error;
      }
    }
    return workerApiRef.current!;
  }, []);

  const processExcelFile = useCallback(async (
    file: File,
    operationDate: string,
    onProgress?: (progress: number) => void,
    options: ProcessFileOptions = {}
  ): Promise<ProcessedExcelData> => {
    const { signal, timeout = 120000 } = options;

    logger.debug('🚀 Iniciando processamento:', { fileName: file.name, size: file.size });

    // Use synchronous processing for small files (< 100KB) or as fallback
    const useSync = file.size < 100000; // 100KB threshold
    if (useSync) {
      logger.debug('📁 Arquivo pequeno detectado, usando processamento síncrono');
      const fileBuffer = await file.arrayBuffer();
      return await syncExcelProcessor.processExcelFile(fileBuffer, operationDate, onProgress);
    }

    // Check for abort signal immediately
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário', 'AbortError');
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let worker: Comlink.Remote<WorkerAPI>;

    try {
      logger.debug('🔧 Hook: Inicializando worker...');
      worker = await initWorker();
      logger.debug('✅ Hook: Worker pronto para uso');

      // Convert file to ArrayBuffer
      logger.debug('📄 Hook: Convertendo arquivo para ArrayBuffer...', {
        nome: file.name,
        extensao: file.name.toLowerCase().substring(file.name.lastIndexOf('.')),
        tipo: file.type,
        tamanho: file.size
      });
      const fileBuffer = await file.arrayBuffer();
      logger.debug('📄 Hook: ArrayBuffer criado com tamanho:', fileBuffer.byteLength);

      // Check abort signal after file reading
      if (signal?.aborted) {
        throw new DOMException('Operação cancelada pelo usuário', 'AbortError');
      }

      // Start progress tracking
      onProgress?.(10);

      // Setup timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new DOMException(`Timeout de ${timeout}ms excedido`, 'TimeoutError'));
        }, timeout);
      });

      // Setup abort handler
      const abortPromise = new Promise<never>((_, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Operação cancelada pelo usuário', 'AbortError'));
          });
        }
      });

      // Process the file in worker with race conditions
      logger.debug('⚙️ Processando arquivo no Web Worker...');
      onProgress?.(30);

      // Simulate progress while processing
      const progressStartTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - progressStartTime;
        const estimatedProgress = 30 + Math.min(50, elapsed / 1000); // Gradual progress from 30% to 80%
        onProgress?.(estimatedProgress);
      }, 500);

      try {
        logger.debug('⚙️ Hook: Chamando worker.processExcelFile...');
        const processingPromise = worker.processExcelFile(fileBuffer, operationDate);
        logger.debug('⚙️ Hook: Promise de processamento criada');

        const promises = [processingPromise];
        if (timeout > 0) {
          logger.debug(`⏰ Hook: Adicionando timeout de ${timeout}ms`);
          promises.push(timeoutPromise);
        }
        if (signal) {
          logger.debug('🛑 Hook: Adicionando abort signal');
          promises.push(abortPromise);
        }

        logger.debug(`🏁 Hook: Iniciando Promise.race com ${promises.length} promises`);
        // Process without callback (worker handles progress internally)
        const result = await Promise.race(promises) as ProcessedExcelData;
        logger.debug('✅ Hook: Processamento concluído com sucesso');

        clearInterval(progressInterval);
        onProgress?.(90);

        logger.debug('✅ Processamento concluído:', {
          totalRows: result.parseResult.stats.totalRows,
          validRows: result.parseResult.stats.validRows,
          errors: result.parseResult.errors.length
        });

        onProgress?.(100);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    } catch (error) {
      logger.error('❌ Erro no processamento com Worker:', error);

      // Terminate worker on error to prevent hanging
      if (workerRef.current) {
        logger.debug('🔄 Terminando worker devido ao erro...');
        workerRef.current.terminate();
        workerRef.current = null;
        workerApiRef.current = null;
      }

      // Try fallback to synchronous processing
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        logger.warn('⚠️ Worker timeout, tentando processamento síncrono como fallback...');
        try {
          const fileBuffer = await file.arrayBuffer();
          logger.debug('🔄 Fallback: Usando processamento síncrono...');
          return await syncExcelProcessor.processExcelFile(fileBuffer, operationDate, onProgress);
        } catch (fallbackError) {
          logger.error('❌ Fallback também falhou:', fallbackError);
          throw new Error(`Erro no processamento (Worker e Fallback): ${fallbackError instanceof Error ? fallbackError.message : 'Erro desconhecido'}`);
        }
      }

      if (error instanceof DOMException) {
        throw error; // Re-throw other DOMExceptions (AbortError)
      }

      throw new Error(`Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      onProgress?.(100);
    }
  }, [initWorker]);

  const processExistingEntries = useCallback(async (
    entries: BankEntryForProcessing[]
  ): Promise<Map<number, number[]>> => {
    const worker = await initWorker();
    return worker.processExistingEntries(entries);
  }, [initWorker]);

  const terminateWorker = useCallback(() => {
    logger.debug('🛑 Terminando Web Worker...');

    if (workerApiRef.current) {
      try {
        // Release Comlink proxy
        workerApiRef.current[Comlink.releaseProxy]();
      } catch (error) {
        logger.warn('Erro ao liberar proxy do worker:', error);
      }
      workerApiRef.current = null;
    }

    if (workerRef.current) {
      try {
        // Terminate the actual worker
        workerRef.current.terminate();
      } catch (error) {
        logger.warn('Erro ao terminar worker:', error);
      }
      workerRef.current = null;
    }
  }, []);

  return {
    processExcelFile,
    processExistingEntries,
    terminateWorker
  };
}