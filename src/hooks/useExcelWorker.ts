import { useRef, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { WorkerAPI, ProcessedExcelData, BankEntryForProcessing } from '../workers/excelProcessor.worker';

export interface ProcessFileOptions {
  signal?: AbortSignal;
  timeout?: number;
}

export function useExcelWorker() {
  const workerRef = useRef<Worker | null>(null);
  const workerApiRef = useRef<Comlink.Remote<WorkerAPI> | null>(null);

  const initWorker = useCallback(async () => {
    if (!workerRef.current) {
      // Create worker from the TypeScript file (Vite will handle compilation)
      const worker = new Worker(
        new URL('../workers/excelProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;
      workerApiRef.current = Comlink.wrap<WorkerAPI>(worker);
    }
    return workerApiRef.current!;
  }, []);

  const processExcelFile = useCallback(async (
    file: File,
    operationDate: string,
    onProgress?: (progress: number) => void,
    options: ProcessFileOptions = {}
  ): Promise<ProcessedExcelData> => {
    const { signal, timeout = 60000 } = options;

    console.log('🚀 Iniciando processamento:', { fileName: file.name, size: file.size });

    // Check for abort signal immediately
    if (signal?.aborted) {
      throw new DOMException('Operação cancelada pelo usuário', 'AbortError');
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let worker: Comlink.Remote<WorkerAPI>;

    try {
      worker = await initWorker();

      // Convert file to ArrayBuffer
      console.log('📄 Convertendo arquivo para ArrayBuffer...');
      const fileBuffer = await file.arrayBuffer();

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
      console.log('⚙️ Processando arquivo no Web Worker...');
      onProgress?.(30);

      const promises = [worker.processExcelFile(fileBuffer, operationDate)];
      if (timeout > 0) promises.push(timeoutPromise);
      if (signal) promises.push(abortPromise);

      // Process with progress callback
      const result = await Promise.race([
        worker.processExcelFile(fileBuffer, operationDate, (progress, stage, message) => {
          console.log(`📊 Progresso: ${progress}% - ${stage} - ${message}`);
          onProgress?.(Math.min(90, progress)); // Cap at 90% until final success
        }),
        ...promises.slice(1) // timeout and abort promises
      ]) as ProcessedExcelData;

      console.log('✅ Processamento concluído:', {
        totalRows: result.parseResult.stats.totalRows,
        validRows: result.parseResult.stats.validRows,
        errors: result.parseResult.errors.length
      });

      onProgress?.(90);
      return result;
    } catch (error) {
      console.error('❌ Erro no processamento:', error);

      // Terminate worker on error to prevent hanging
      if (workerRef.current) {
        console.log('🔄 Terminando worker devido ao erro...');
        workerRef.current.terminate();
        workerRef.current = null;
        workerApiRef.current = null;
      }

      if (error instanceof DOMException) {
        throw error; // Re-throw DOMException (AbortError, TimeoutError)
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
    console.log('🛑 Terminando Web Worker...');

    if (workerApiRef.current) {
      try {
        // Release Comlink proxy
        workerApiRef.current[Comlink.releaseProxy]();
      } catch (error) {
        console.warn('Erro ao liberar proxy do worker:', error);
      }
      workerApiRef.current = null;
    }

    if (workerRef.current) {
      try {
        // Terminate the actual worker
        workerRef.current.terminate();
      } catch (error) {
        console.warn('Erro ao terminar worker:', error);
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