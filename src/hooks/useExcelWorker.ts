import { useRef, useCallback } from 'react';
import * as Comlink from 'comlink';
import type { WorkerAPI, ProcessedExcelData, BankEntryForProcessing } from '../workers/excelProcessor.worker';

export function useExcelWorker() {
  const workerRef = useRef<Comlink.Remote<WorkerAPI> | null>(null);

  const initWorker = useCallback(async () => {
    if (!workerRef.current) {
      // Create worker from the TypeScript file (Vite will handle compilation)
      const worker = new Worker(
        new URL('../workers/excelProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = Comlink.wrap<WorkerAPI>(worker);
    }
    return workerRef.current;
  }, []);

  const processExcelFile = useCallback(async (
    file: File,
    operationDate: string,
    onProgress?: (progress: number) => void
  ): Promise<ProcessedExcelData> => {
    const worker = await initWorker();

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Start progress tracking
    onProgress?.(10);

    try {
      // Process the file in worker
      onProgress?.(30);
      const result = await worker.processExcelFile(fileBuffer, operationDate);

      onProgress?.(90);
      return result;
    } catch (error) {
      throw new Error(`Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
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
    if (workerRef.current) {
      // Terminate the worker
      const worker = workerRef.current[Comlink.releaseProxy];
      if (worker && typeof worker === 'function') {
        worker();
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