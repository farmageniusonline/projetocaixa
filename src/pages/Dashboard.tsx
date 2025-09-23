import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ManipulariumLogo from '../assets/ManipulariumLogo.png';
import { parseExcelFile, ParseResult as ExcelParseResult } from '../utils/excelParser';
import { ParseResult } from '../workers/excelProcessor.worker';
import { DataTable } from '../components/DataTable';
import { VirtualizedDataTable } from '../components/VirtualizedDataTable';
import { VirtualizedCashTable } from '../components/VirtualizedCashTable';
import { VirtualizedHistoryTable } from '../components/VirtualizedHistoryTable';
import { ValueSelectionModal } from '../components/ValueSelectionModal';
import { CashConferenceTable } from '../components/CashConferenceTable';
import { DateSelector } from '../components/DateSelector';
import { HistoryByDate } from '../components/HistoryByDate';
import { ActionLogPanel } from '../components/ActionLogPanel';
import { BackupPanel } from '../components/BackupPanel';
import { ExportButtons } from '../components/ExportButtons';
import { searchValueMatches, validateValueInput, ValueMatch, createValueIndex } from '../utils/valueNormalizer';
import { formSchemas, safeValidate } from '../utils/validationSchemas';
import { ValidationError, useFieldValidation } from '../components/ValidationError';
import { DevPerformancePanel } from '../components/DevPerformancePanel';
import { KeyboardShortcutsHelp } from '../components/KeyboardShortcutsHelp';
import { performanceLogger } from '../utils/performanceLogger';
import { logger } from '../utils/logger';
import { useDashboardFilters, usePersistentState } from '../hooks/usePersistentState';
import StorageAdapter from '../lib/storageAdapter';
import { dataAdapter } from '../services/dataAdapter';
import { ConferenceHistoryEntry } from '../lib/storageAdapter';
import { formatForDisplay, getTodayDDMMYYYY, formatDateForQuery } from '../utils/dateFormatter';
import { LaunchTab } from '../components/LaunchTab';
import { useDebounce } from '../hooks/useDebounce';
import { StorageStatus } from '../components/StorageStatus';
import { ProcessingSpinner, useProcessingState } from '../components/ProcessingSpinner';
import { useExcelWorker, ProcessFileOptions } from '../hooks/useExcelWorker';
import { executeBankingUploadTransaction, handleTransactionError } from '../lib/dexieTransactions';
import { useGlobalKeyboardShortcuts, useFocusManager, useFocusRestore } from '../hooks/useKeyboardShortcuts';
import { useValueLookup } from '../hooks/useValueLookup';
import { FeatureErrorBoundary } from '../components/common/FeatureErrorBoundary';
import { MetricsDashboard } from '../components/MetricsDashboard';
import { queryCache } from '../services/CacheService';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  // Web Worker hooks
  const { processExcelFile, terminateWorker } = useExcelWorker();
  const processingState = useProcessingState();

  // AbortController for cancelling operations
  const abortControllerRef = useRef<AbortController | null>(null);

  // Value lookup hook for O(1) search
  const valueLookup = useValueLookup();

  // Persistent state hooks
  const [dashboardFilters, setDashboardFilters] = useDashboardFilters();
  const [activeTab, setActiveTab] = usePersistentState<'banking' | 'cash' | 'launches' | 'actions' | 'backup' | 'relatorio-diario'>('dashboard_active_tab', 'banking');
  const [showHistory, setShowHistory] = usePersistentState('dashboard_show_history', false);
  const [showMetricsDashboard, setShowMetricsDashboard] = useState(false);

  // Local state (non-persistent)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [operationDate, setOperationDate] = useState<string>(getTodayDDMMYYYY());
  const [uploadMode, setUploadMode] = useState<'automatic' | 'manual'>('automatic');
  const [error, setError] = useState<string | null>(null);
  const [loadedHistory, setLoadedHistory] = useState<ConferenceHistoryEntry[]>([]);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);

  // Focus management for keyboard shortcuts
  const { registerFocusTarget, focusTarget, getFocusTarget } = useFocusManager();
  const { saveFocus, restoreFocus } = useFocusRestore();

  // Refs for keyboard shortcuts
  const conferenceValueRef = useRef<HTMLInputElement>(null);
  const dateFilterRef = useRef<HTMLInputElement>(null);

  // Persistent state for parsed data
  // Compatible parse result interface for table display
  interface CompatibleParseResult {
    success: boolean;
    data: ValueMatch[];
    errors: string[];
    warnings: string[];
    stats: {
      totalRows: number;
      validRows: number;
      rowsWithWarnings: number;
      rowsWithErrors: number;
      totalValue: number;
    };
  }

  const [parseResult, setParseResult] = usePersistentState<CompatibleParseResult | null>('dashboard_parse_result', null);

  // Value index for optimized search
  const [valueIndex, setValueIndex] = useState<Map<number, ValueMatch[]> | null>(null);
  
  // Conference states - persistent
  const [conferredItems, setConferredItems] = usePersistentState<Array<ValueMatch & { conferredAt: Date; conferredId: string }>>('dashboard_conferred_items', [], {
    serialize: (value) => JSON.stringify(value.map(item => ({ ...item, conferredAt: item.conferredAt.toISOString() }))),
    deserialize: (value) => JSON.parse(value).map((item: any) => {
      let conferredAt = new Date();
      try {
        if (item.conferredAt) {
          const parsed = new Date(item.conferredAt);
          if (!isNaN(parsed.getTime())) {
            conferredAt = parsed;
          }
        }
      } catch (e) {
        logger.warn('Invalid conferredAt value:', item.conferredAt);
      }
      return {
        ...item,
        conferredAt
      };
    })
  });
  const [transferredIds, setTransferredIds] = usePersistentState<Set<string>>('dashboard_transferred_ids', new Set(), {
    serialize: (value) => JSON.stringify(Array.from(value)),
    deserialize: (value) => new Set(JSON.parse(value))
  });
  const [notFoundHistory, setNotFoundHistory] = usePersistentState<Array<{
    value: string;
    timestamp: Date;
    status: 'not_found';
  }>>('dashboard_not_found_history', [], {
    serialize: (value) => JSON.stringify(value.map(item => ({ ...item, timestamp: item.timestamp.toISOString() }))),
    deserialize: (value) => JSON.parse(value).map((item: any) => {
      let timestamp = new Date();
      try {
        if (item.timestamp) {
          const parsed = new Date(item.timestamp);
          if (!isNaN(parsed.getTime())) {
            timestamp = parsed;
          }
        }
      } catch (e) {
        logger.warn('Invalid timestamp value:', item.timestamp);
      }
      return {
        ...item,
        timestamp
      };
    })
  });

  // Conference states - non-persistent
  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<ValueMatch[]>([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [previewResults, setPreviewResults] = useState<number | null>(null);

  // Historical data filtering states
  const [filteredConferredItems, setFilteredConferredItems] = useState<Array<ValueMatch & { conferredAt: Date; conferredId: string }>>([]);
  const [isShowingFiltered, setIsShowingFiltered] = useState(false);

  // Keyboard shortcuts setup
  const closeModals = useCallback(() => {
    setShowSelectionModal(false);
    setShowRestartModal(false);
    setShowPerformancePanel(false);
    restoreFocus();
  }, [restoreFocus]);

  // Transfer function for conference - must be defined BEFORE handleConferenceCheck
  const transferToConference = useCallback(async (match: ValueMatch) => {
    logger.debug('Starting transfer to conference:', {
      matchId: match.id,
      matchValue: match.value,
      matchType: typeof match.value,
      currentTransferredIds: Array.from(transferredIds)
    });

    const conferredId = `conf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const conferredItem = {
      ...match,
      conferredAt: new Date(),
      conferredId,
    };

    // Add to conferred items
    setConferredItems(prev => [...prev, conferredItem]);

    // Mark as transferred to remove from banking table
    setTransferredIds(prev => {
      const newSet = new Set([...prev, match.id]);
      logger.debug('Updated transferredIds:', {
        previousSize: prev.size,
        newSize: newSet.size,
        addedId: match.id,
        newTransferredIds: Array.from(newSet)
      });

      // Force immediate update check
      setTimeout(() => {
        logger.debug('Post-transfer state check:', {
          transferredIdsIncludes: newSet.has(match.id),
          transferredIdsSize: newSet.size,
          matchId: match.id
        });
      }, 100);

      return newSet;
    });

    // Update lookup map incrementally
    valueLookup.updateEntryStatus(match.id, match.value, 'conferred');

    // Save to database
    try {
      await StorageAdapter.saveCashConference(
        match,
        operationDate,
        'conferred'
      );
    } catch (dbError) {
      logger.error('Error saving conference to database:', dbError);
    }

    // Clear input and show success
    setConferenceValue('');
    setSearchSuccess('Valor encontrado e transferido para Conferência de Caixa.');

    // Focus back on the input field
    setTimeout(() => {
      const input = document.querySelector('input[placeholder*="Digite o valor"]') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);

    // Clear success message after 3 seconds
    setTimeout(() => setSearchSuccess(null), 3000);

    logger.debug('Transfer to conference completed:', {
      matchId: match.id,
      matchValue: match.value,
      conferredItemsCount: conferredItems.length + 1,
      finalTransferredIdsSize: transferredIds.size
    });

    // Force a small delay to ensure state propagation and re-render
    setTimeout(() => {
      logger.debug('Final verification - item should be hidden from banking table:', {
        itemId: match.id,
        isInTransferredIds: transferredIds.has(match.id),
        transferredIdsArray: Array.from(transferredIds)
      });
    }, 200);
  }, [operationDate, conferredItems.length, transferredIds.size]);

  // Monitor transferredIds changes for debugging
  useEffect(() => {
    logger.debug('transferredIds state changed:', {
      size: transferredIds.size,
      ids: Array.from(transferredIds),
      parseResultDataLength: parseResult?.data?.length || 0
    });
  }, [transferredIds, parseResult?.data?.length]);

  // Force load parseResult on component mount
  useEffect(() => {
    logger.debug('Dashboard mounted, checking localStorage...');
    const storedParseResult = localStorage.getItem('dashboard_parse_result');
    const storedTransferredIds = localStorage.getItem('dashboard_transferred_ids');

    logger.debug('Stored data check:', {
      hasParseResult: !!storedParseResult,
      hasTransferredIds: !!storedTransferredIds,
      currentParseResult: !!parseResult,
      currentTransferredIdsSize: transferredIds.size
    });

    // If localStorage has data but state doesn't, force reload
    if (storedParseResult && !parseResult) {
      logger.debug('Found stored parseResult but state is empty, forcing reload...');
      try {
        const parsed = JSON.parse(storedParseResult);
        if (parsed && parsed.data && parsed.data.length > 0) {
          logger.debug('Manually setting parseResult from localStorage', {
            dataLength: parsed.data.length
          });
          setParseResult(parsed);
        }
      } catch (error) {
        logger.error('Error parsing stored parseResult:', error);
      }
    }
  }, []); // Run only on mount

  // Conference value search and transfer logic
  const handleConferenceCheck = useCallback(async () => {
    // Use Zod validation instead of legacy validator
    const validation = safeValidate(formSchemas.conferenceValue, {
      value: dashboardFilters.conferenceValue
    });

    if (!validation.success) {
      setSearchError(validation.error);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchMatches([]);

    try {
      const searchValue = dashboardFilters.conferenceValue.trim();
      logger.debug('Conference search started:', {
        searchValue,
        selectedDate: dashboardFilters.selectedDate,
        parseResultExists: !!parseResult,
        parseResultDataLength: parseResult?.data?.length || 0,
        valueIndexSize: valueIndex?.size || 0
      });

      let results: any[] = [];

      // PRIORITY 1: Search in loaded spreadsheet data first
      if (parseResult?.data && valueIndex) {
        logger.debug('Trying primary search in loaded spreadsheet data:', {
          parseResultDataSample: parseResult.data.slice(0, 5).map(item => ({
            id: item.id,
            value: item.value,
            valueType: typeof item.value,
            date: item.date,
            originalHistory: item.originalHistory
          })),
          searchValue,
          searchValueType: typeof searchValue,
          valueIndexKeys: Array.from(valueIndex.keys()).slice(0, 15),
          valueIndexValues: Array.from(valueIndex.entries()).slice(0, 5).map(([key, matches]) => ({
            key,
            matchesCount: matches.length,
            firstMatchValue: matches[0]?.value
          }))
        });

        const localResults = searchValueMatches(searchValue, parseResult.data, valueIndex);

        logger.debug('Spreadsheet search results:', {
          hasMatches: localResults.hasMatches,
          matchesLength: localResults.matches.length,
          normalizedInput: localResults.normalizedInput,
          matches: localResults.matches.slice(0, 3),
          firstMatchId: localResults.matches[0]?.id,
          originalDataSampleIds: parseResult.data.slice(0, 5).map(item => ({ id: item.id, value: item.value })),
          transferredIdsBeforeMatch: Array.from(transferredIds)
        });

        if (localResults.hasMatches) {
          results = localResults.matches;
        }
      }

      // PRIORITY 2: Only search database if nothing found in spreadsheet
      if (results.length === 0) {
        logger.debug('No matches in spreadsheet, trying database search...');

        results = await performanceLogger.measureAsync('conference_search', async () => {
          return await dataAdapter.searchConferenceValue(
            searchValue,
            dashboardFilters.selectedDate || formatDateForQuery(new Date())
          );
        });

        logger.debug('Database search results:', {
          resultsLength: results.length,
          results: results.slice(0, 3)
        });
      }

      if (results.length === 0) {
        // Original error handling
        if (!parseResult || !parseResult.data || parseResult.data.length === 0) {
          setSearchError('Nenhuma planilha carregada. Por favor, carregue uma planilha na aba "Conferência Bancária" primeiro.');
        } else {
          setSearchError('Nenhum valor encontrado para conferência');
        }
        return;
      }

      setSearchMatches(results);

      if (results.length === 1) {
        // Auto-select if only one match - use transferToConference for proper handling
        logger.debug('Auto-transferring single match:', results[0]);
        await transferToConference(results[0]);
        setSearchMatches([]);
      } else {
        // Show selection modal for multiple matches
        saveFocus();
        setShowSelectionModal(true);
      }
    } catch (error: any) {
      logger.error('Erro na busca de conferência:', error);
      setSearchError(error.message || 'Erro interno na busca');
    } finally {
      setIsSearching(false);
    }
  }, [
    dashboardFilters.conferenceValue,
    dashboardFilters.selectedDate,
    setSearchError,
    setSearchMatches,
    setConferredItems,
    setDashboardFilters,
    setSearchSuccess,
    saveFocus,
    setShowSelectionModal,
    setIsSearching,
    transferToConference
  ]);

  const handleConfirmAction = useCallback(() => {
    // Determine current context and perform appropriate action
    if (showSelectionModal && searchMatches.length > 0) {
      // If modal is open, select first match
      const firstMatch = searchMatches[0];
      if (firstMatch) {
        saveFocus();
        setShowSelectionModal(false);
        const conferredItem = {
          ...firstMatch,
          conferredAt: new Date(),
          conferredId: `conf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        setConferredItems(prev => [conferredItem, ...prev]);
        setDashboardFilters(prev => ({ ...prev, conferenceValue: '' }));
        setSearchMatches([]);
        setSearchSuccess('Valor conferido com sucesso!');
        setTimeout(() => setSearchSuccess(null), 3000);
        restoreFocus();
      }
    } else if (dashboardFilters.conferenceValue && !showSelectionModal) {
      // If typing in conference field, trigger search
      handleConferenceCheck();
    }
  }, [showSelectionModal, searchMatches, dashboardFilters.conferenceValue, saveFocus, restoreFocus, setConferredItems, setDashboardFilters, handleConferenceCheck]);

  const openDateFilter = useCallback(() => {
    const dateInput = getFocusTarget('dateFilter');
    if (dateInput) {
      dateInput.focus();
    } else {
      // If date input not available, focus on the closest date-related element
      focusTarget('dateFilter');
    }
  }, [getFocusTarget, focusTarget]);

  // Register focus targets for keyboard shortcuts
  useEffect(() => {
    registerFocusTarget('conferenceValue', conferenceValueRef.current);
    registerFocusTarget('dateFilter', dateFilterRef.current);
  }, [registerFocusTarget]);

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts(
    {
      valueInput: getFocusTarget('valueInput'),
      conferenceValue: getFocusTarget('conferenceValue'),
      dateFilter: getFocusTarget('dateFilter')
    },
    {
      openDateFilter,
      closeModals,
      confirmAction: handleConfirmAction,
      // Navigation shortcuts
      switchToLaunches: () => handleTabChange('launches'),
      switchToBanking: () => handleTabChange('banking'),
      switchToCash: () => handleTabChange('cash'),
      switchToReports: () => handleTabChange('relatorio-diario'),
      switchToActions: () => handleTabChange('actions'),
      switchToBackup: () => handleTabChange('backup'),
      // Action shortcuts
      exportData: () => {
        // Export current tab data
        if (activeTab === 'banking' && parseResult?.data) {
          logger.info('Exporting banking data via keyboard shortcut');
          // Trigger export of current data
          toast.success('Exportando dados bancários...');
        } else if (activeTab === 'cash' && conferredItems.length > 0) {
          logger.info('Exporting cash conference data via keyboard shortcut');
          toast.success('Exportando conferências...');
        }
      },
      refreshData: () => {
        // Refresh current view data
        logger.info('Refreshing data via keyboard shortcut');
        if (activeTab === 'banking') {
          // Clear caches and reload
          queryCache.clear();
          toast.success('Dados atualizados');
        }
      },
      toggleMetrics: () => setShowMetricsDashboard(!showMetricsDashboard)
    }
  );

  // Debounce the conference value for preview
  const debouncedConferenceValue = useDebounce(dashboardFilters.conferenceValue, 300);

  // Preview search results as user types
  useEffect(() => {
    if (debouncedConferenceValue && parseResult?.data && valueIndex) {
      const validation = validateValueInput(debouncedConferenceValue);
      if (validation.isValid) {
        const result = performanceLogger.measureSync('conference_search', () => {
          return searchValueMatches(debouncedConferenceValue, parseResult.data, valueIndex);
        }, {
          valueSearched: debouncedConferenceValue,
          dataSize: parseResult.data.length
        });
        setPreviewResults(result.matches.length);
      } else {
        setPreviewResults(null);
      }
    } else {
      setPreviewResults(null);
    }
  }, [debouncedConferenceValue, parseResult, valueIndex]);

  // Create value index when parseResult is loaded from persistent state
  useEffect(() => {
    logger.debug('parseResult effect triggered:', {
      parseResultExists: !!parseResult,
      parseResultData: parseResult?.data?.length || 0,
      valueIndexExists: !!valueIndex,
      parseResultSample: parseResult?.data?.slice(0, 3)
    });

    if (parseResult && parseResult.data && parseResult.data.length > 0 && !valueIndex) {
      logger.debug('Creating value index from persistent data...');
      const index = createValueIndex(parseResult.data);
      setValueIndex(index);
      logger.debug(`Índice criado com ${index.size} valores únicos`, {
        sampleKeys: Array.from(index.keys()).slice(0, 10)
      });
    }
  }, [parseResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    logger.debug('File selected:', file);
    if (file) {
      logger.debug('File details:', { name: file.name, size: file.size, type: file.type });
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleCancelProcessing = useCallback(() => {
    logger.debug('🛑 Cancelando processamento...');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    terminateWorker();
    processingState.stopProcessing();
    setError(null);
    toast.info('Processamento cancelado pelo usuário');
  }, [terminateWorker, processingState]);

  const handleLoadFile = async () => {
    logger.debug('🚀 handleLoadFile called, selectedFile:', selectedFile);
    if (!selectedFile) {
      logger.debug('❌ No file selected');
      return;
    }

    // Validate file first with user-friendly messages
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      const errorMessage = `Arquivo muito grande: ${fileSizeMB}MB (máximo: 50MB)`;
      setError(errorMessage);
      toast.error(
        `📁 Arquivo muito grande\n` +
        `📊 Tamanho atual: ${fileSizeMB}MB\n` +
        `⚠️ Tamanho máximo: 50MB\n` +
        `💡 Reduza o arquivo ou divida em partes menores`,
        { duration: 8000 }
      );
      return;
    }

    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
    if (!allowedTypes.includes(fileExtension)) {
      const errorMessage = `Tipo de arquivo não suportado: ${fileExtension}`;
      setError(errorMessage);
      toast.error(
        `📄 Formato de arquivo não suportado\n` +
        `❌ Arquivo atual: ${fileExtension}\n` +
        `✅ Formatos aceitos: .xlsx, .xls, .csv\n` +
        `🔄 Converta o arquivo para um formato suportado`,
        { duration: 8000 }
      );
      return;
    }

    // Check if file seems valid (not empty, has extension)
    if (selectedFile.size === 0) {
      setError('Arquivo vazio ou corrompido');
      toast.error(
        `📄 Arquivo vazio\n` +
        `⚠️ O arquivo selecionado não tem conteúdo\n` +
        `🔧 Verifique se o arquivo não está corrompido`,
        { duration: 6000 }
      );
      return;
    }

    logger.debug('✅ Starting file processing with Web Worker...');
    const startTime = Date.now();

    // Create new AbortController for this operation
    abortControllerRef.current = new AbortController();

    processingState.startProcessing('parsing');
    setError(null);

    try {
      // Setup processing options with 60s timeout
      const options: ProcessFileOptions = {
        signal: abortControllerRef.current.signal,
        timeout: 60000 // 60 seconds
      };

      // Process file in Web Worker with proper error handling
      processingState.updateStage('parsing', 'Lendo planilha...');
      const processedData = await processExcelFile(
        selectedFile,
        operationDate,
        (progress) => {
          logger.debug(`📊 Upload progress: ${progress}%`);
          processingState.updateProgress(progress);
        },
        options
      );

      // Check for abort after processing
      if (abortControllerRef.current?.signal.aborted) {
        logger.debug('🛑 Processing was aborted');
        return;
      }

      const processingTime = Date.now() - startTime;
      logger.debug(`⚡ Processing completed in ${processingTime}ms`);

      if (processedData.parseResult.success) {
        processingState.updateStage('indexing', 'Criando índices de busca...');

        // Convert ParsedRow[] to ValueMatch[] for compatibility
        const convertedData: ValueMatch[] = processedData.parseResult.data.map((row, index) => ({
          id: `row_${index}`,
          date: row.date,
          paymentType: row.paymentType,
          cpf: row.cpf,
          value: row.value,
          originalHistory: row.originalHistory,
          rowIndex: index,
          validationStatus: row.validationStatus,
          validationMessage: row.validationMessage,
          bankData: {
            date: row.date,
            description: row.originalHistory,
            value: row.value,
            documentNumber: row.cpf,
            transactionType: row.paymentType
          }
        }));

        logger.debug('Created ValueMatch data with IDs:', {
          totalRows: convertedData.length,
          sampleIds: convertedData.slice(0, 5).map(item => item.id),
          sampleValues: convertedData.slice(0, 5).map(item => ({ id: item.id, value: item.value }))
        });

        // Create compatible ParseResult with ValueMatch[]
        const compatibleParseResult: CompatibleParseResult = {
          success: processedData.parseResult.success,
          data: convertedData,
          errors: processedData.parseResult.errors,
          warnings: processedData.parseResult.warnings,
          stats: processedData.parseResult.stats
        };

        setParseResult(compatibleParseResult);

        // Automatically select today's date after successful spreadsheet loading
        const todayFormatted = formatDateForQuery(new Date());
        setDashboardFilters(prev => ({ ...prev, selectedDate: todayFormatted }));
        logger.debug(`📅 Data selecionada automaticamente: ${todayFormatted}`);

        // Create value index from converted data
        const index = createValueIndex(convertedData);
        setValueIndex(index);
        logger.debug(`🔍 Índice criado com ${index.size} valores únicos`);

        processingState.updateStage('saving', 'Salvando no banco de dados...');

        // Save to database using secure transaction
        try {
          const bankingData = {
            entries: processedData.normalizedEntries.map(entry => ({
              source_id: entry.source_id,
              day: entry.day,
              document_number: entry.document_number,
              date: entry.date,
              description: entry.description,
              value_cents: entry.value_cents,
              value: entry.value,
              transaction_type: entry.transaction_type,
              balance: entry.balance,
              status: entry.status,
              source: 'banking_upload' as const
            })),
            fileName: selectedFile.name,
            operationDate,
            uploadMode,
            userId: user?.username || 'default_user'
          };

          logger.debug('💾 Saving to database with transaction...');
          const dbResult = await executeBankingUploadTransaction(bankingData);

          if (dbResult.success) {
            logger.debug('✅ Data saved to database successfully:', dbResult.data);
            toast.success(
              `✅ Arquivo processado com sucesso!\n` +
              `⏱️ Tempo: ${processingTime}ms\n` +
              `📊 ${processedData.parseResult.stats.totalRows} linhas processadas\n` +
              `✔️ ${processedData.parseResult.stats.validRows} válidas`,
              { duration: 5000 }
            );
          } else {
            logger.error('❌ Database save failed:', dbResult.error);
            handleTransactionError(dbResult, 'Erro ao salvar no banco');

            // Show a specific toast for database issues but don't fail parsing
            toast.error(
              `⚠️ Dados processados mas erro ao salvar no banco\n` +
              `📊 ${processedData.parseResult.stats.totalRows} linhas ainda disponíveis na tabela\n` +
              `❌ ${dbResult.error}`,
              { duration: 8000 }
            );
          }
        } catch (dbError) {
          logger.error('❌ Critical database error:', dbError);
          toast.error(
            `❌ Erro crítico no banco de dados\n` +
            `📊 Dados processados e visíveis na tabela\n` +
            `🔧 Verifique a configuração do banco`,
            { duration: 8000 }
          );
        }

        logger.debug(`📊 Processing summary:`);
        logger.debug(`  - Tempo total: ${processingTime}ms`);
        logger.debug(`  - Linhas processadas: ${processedData.parseResult.stats.totalRows}`);
        logger.debug(`  - Linhas válidas: ${processedData.parseResult.stats.validRows}`);
        logger.debug(`  - Avisos: ${processedData.parseResult.warnings.length}`);
        logger.debug(`  - Erros: ${processedData.parseResult.errors.length}`);
      } else {
        // Processing failed
        const errorMsg = processedData.parseResult.errors.join('\n');
        logger.error('❌ Parse failed:', errorMsg);
        setError(errorMsg);
        setParseResult(null);

        toast.error(
          `❌ Erro no processamento da planilha\n` +
          `📄 Verifique se o formato está correto\n` +
          `🔍 ${processedData.parseResult.errors.length} erro(s) encontrado(s)`,
          { duration: 8000 }
        );
      }
    } catch (err) {
      logger.error('💥 Critical error processing file:', err);

      // Handle different error types with user-friendly messages
      if (err instanceof DOMException) {
        if (err.name === 'AbortError') {
          logger.debug('🛑 Operation was aborted');
          return; // Don't show error for user-initiated abort
        } else if (err.name === 'TimeoutError') {
          const errorMessage = '⏰ Timeout: Arquivo muito grande ou complexo';
          setError(errorMessage);
          toast.error(
            `⏰ Processamento interrompido por timeout\n` +
            `📁 Arquivo muito grande ou complexo\n` +
            `💡 Tente reduzir o tamanho ou simplificar os dados`,
            { duration: 10000 }
          );
        }
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao processar arquivo';
        setError(errorMessage);

        // Categorize common errors for better UX
        if (errorMessage.includes('XLSX') || errorMessage.includes('planilha')) {
          toast.error(
            `📄 Erro no formato da planilha\n` +
            `✅ Formatos suportados: .xlsx, .xls, .csv\n` +
            `🔧 Verifique se o arquivo não está corrompido`,
            { duration: 8000 }
          );
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          toast.error(
            `🌐 Erro de conexão\n` +
            `🔄 Verifique sua conexão com a internet\n` +
            `⚡ Tente novamente em alguns segundos`,
            { duration: 8000 }
          );
        } else if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
          toast.error(
            `💾 Erro de memória\n` +
            `📁 Arquivo muito grande para o sistema\n` +
            `📉 Tente um arquivo menor ou feche outras abas`,
            { duration: 8000 }
          );
        } else {
          toast.error(
            `❌ Erro inesperado no processamento\n` +
            `🔍 ${errorMessage}\n` +
            `🔄 Tente recarregar a página`,
            { duration: 8000 }
          );
        }
      }

      setParseResult(null);

      // Clean up worker on error
      terminateWorker();
    } finally {
      // Always clean up
      abortControllerRef.current = null;
      processingState.stopProcessing();
      logger.debug('🏁 Upload operation finished');
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setParseResult(null);
    setValueIndex(null);
    setError(null);
    // Reset transfer tracking
    setTransferredIds(new Set());
    setConferredItems([]);
    setNotFoundHistory([]);
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleDateFilter = () => {
    if (!dashboardFilters.selectedDate) {
      setSearchError('Selecione uma data para carregar o histórico.');
      return;
    }

    logger.debug('Carregando histórico para data:', dashboardFilters.selectedDate);

    try {
      // Validate date before creating Date object
      if (!dashboardFilters.selectedDate || dashboardFilters.selectedDate === 'Invalid Date') {
        setSearchError('Data inválida selecionada.');
        return;
      }

      const selectedDate = new Date(dashboardFilters.selectedDate + 'T00:00:00');
      const dateString = formatForDisplay(selectedDate);

      // Filter conferred items by selected date
      const conferredForDate = conferredItems.filter(item => {
        if (!item.conferredAt) return false;
        const itemDate = new Date(item.conferredAt);
        return !isNaN(itemDate.getTime()) && itemDate.toDateString() === selectedDate.toDateString();
      });

      // Filter not found history by selected date
      const notFoundForDate = notFoundHistory.filter(item => {
        if (!item.timestamp) return false;
        const itemDate = new Date(item.timestamp);
        return !isNaN(itemDate.getTime()) && itemDate.toDateString() === selectedDate.toDateString();
      });

      // Calculate totals
      const totalConferred = conferredForDate.length;
      const totalNotFound = notFoundForDate.length;
      const totalValue = conferredForDate.reduce((sum, item) => sum + item.value, 0);

      // Show summary message and update filtered data
      if (totalConferred === 0 && totalNotFound === 0) {
        setSearchError(`Nenhum registro encontrado para ${dateString}.`);
        setFilteredConferredItems([]);
        setIsShowingFiltered(false);
      } else {
        const summary = [
          `Histórico de ${dateString}:`,
          `• ${totalConferred} conferências realizadas`,
          `• ${totalNotFound} valores não encontrados`,
          totalValue > 0 ? `• Valor total: ${new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(totalValue)}` : ''
        ].filter(Boolean).join('\n');

        setSearchSuccess(summary);
        setTimeout(() => setSearchSuccess(null), 5000);

        // Set filtered data for display in Conferência de Caixa tab
        setFilteredConferredItems(conferredForDate);
        setIsShowingFiltered(true);

        // Automatically switch to cash tab if there are results
        if (totalConferred > 0) {
          setActiveTab('cash');
        }
      }

    } catch (error) {
      logger.error('Erro ao filtrar por data:', error);
      setSearchError('Erro ao carregar histórico. Verifique a data selecionada.');
    }
  };

  const handleRestartCurrentDay = () => {
    setShowRestartModal(true);
  };

  const handleConfirmRestart = () => {
    // Clear all transferred items (Conferência de Caixa)
    setConferredItems([]);
    
    // Clear transferred IDs to restore banking table to initial state
    setTransferredIds(new Set());
    
    // Clear not found history
    setNotFoundHistory([]);
    
    // Clear current input and messages
    setConferenceValue('');
    setSearchError(null);
    setSearchSuccess('Dia atual reiniciado com sucesso.');
    setTimeout(() => setSearchSuccess(null), 3000);
    
    // Close modal
    setShowRestartModal(false);
    
    // Focus back on the input field
    setTimeout(() => {
      const input = document.querySelector('input[placeholder*="Digite o valor"]') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  };

  const handleCancelRestart = () => {
    setShowRestartModal(false);
  };


  const handleModalSelection = useCallback((match: ValueMatch) => {
    transferToConference(match);
    setShowSelectionModal(false);
    setSearchMatches([]);
  }, [transferToConference]);

  const handleModalClose = useCallback(() => {
    setShowSelectionModal(false);
    setSearchMatches([]);
    setIsSearching(false);
  }, []);

  const handleRemoveConferredItem = useCallback((conferredId: string) => {
    const itemToRemove = conferredItems.find(item => item.conferredId === conferredId);
    if (itemToRemove) {
      // Remove from conferred items
      setConferredItems(prev => prev.filter(item => item.conferredId !== conferredId));
      // Remove from transferred IDs to make it available again in banking
      setTransferredIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemToRemove.id);
        return newSet;
      });

      // Update lookup map incrementally - mark as available again
      valueLookup.updateEntryStatus(itemToRemove.id, itemToRemove.value, 'pending');
    }
  }, [conferredItems, valueLookup]);

  // Clear messages when switching tabs or changing values
  const handleTabChange = (tab: 'banking' | 'cash' | 'launches' | 'actions' | 'backup' | 'relatorio-diario') => {
    setActiveTab(tab);
    setSearchError(null);
    setSearchSuccess(null);
  };

  const setConferenceValue = (value: string) => {
    setDashboardFilters(prev => ({ ...prev, conferenceValue: value }));
  };

  const handleConferenceValueChange = (value: string) => {
    setConferenceValue(value);
    setSearchError(null);
    setSearchSuccess(null);
  };

  // Handle launches from LaunchTab
  const handleLaunchAdded = useCallback((launchItem: any) => {
    if (launchItem.remove) {
      // Remove from conferredItems if it exists
      setConferredItems(prev => prev.filter(item => item.conferredId !== launchItem.conferredId));

      // Remove from lookup map
      valueLookup.removeEntry(launchItem.id, launchItem.value);
    } else {
      // Add to conferredItems
      const newConferredItem = {
        id: launchItem.id,
        date: launchItem.date,
        description: launchItem.description,
        value: launchItem.value,
        cpf: launchItem.cpf || '',
        originalHistory: launchItem.originalHistory,
        source: launchItem.source,
        conferredAt: launchItem.conferredAt,
        conferredId: launchItem.conferredId
      };

      setConferredItems(prev => [...prev, newConferredItem]);

      // Add to lookup map if it's a new manual entry
      if (launchItem.source === 'manual_entry') {
        const mockHistoryEntry: ConferenceHistoryEntry = {
          id: launchItem.id,
          operation_date: launchItem.date,
          operation_type: 'manual_entry',
          value: launchItem.value,
          description: launchItem.description,
          status: 'active',
          source: 'manual_entry',
          user_id: 'default_user'
        };
        valueLookup.addEntry(mockHistoryEntry);
      }
    }
  }, [valueLookup]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <header className="bg-gray-900 shadow-lg border-b border-gray-800">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img 
                src={ManipulariumLogo} 
                alt="Manipularium Logo" 
                className="h-8 w-auto drop-shadow-lg"
              />
              <h1 className="ml-3 text-xl font-semibold text-gray-100">
                Manipularium - Sistema de Conferência
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">
                <strong className="text-gray-100">{user?.username}</strong>
              </span>

              {/* Performance Metrics Button */}
              <button
                onClick={() => setShowMetricsDashboard(!showMetricsDashboard)}
                className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md transition-colors ${
                  showMetricsDashboard
                    ? 'border-blue-500 text-blue-400 bg-blue-900/30 hover:bg-blue-900/50'
                    : 'border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-gray-100'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500`}
                title="Performance Metrics Dashboard"
              >
                📊
                <span className="ml-1 hidden sm:inline">Métricas</span>
              </button>

              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-gray-700 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transition-colors"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sair
              </button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="flex space-x-1 border-t border-gray-800 pt-2">
            <button
              onClick={() => handleTabChange('launches')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'launches'
                  ? 'bg-gray-800 text-gray-100 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              Lançamentos
            </button>
            <button
              onClick={() => handleTabChange('banking')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'banking'
                  ? 'bg-gray-800 text-gray-100 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              Conferência Bancária
              {parseResult && (
                <span className="ml-2 px-2 py-1 text-xs bg-indigo-600 text-white rounded-full">
                  {parseResult.stats.totalRows - transferredIds.size}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('cash')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'cash'
                  ? 'bg-gray-800 text-gray-100 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              Conferência de Caixa
              {conferredItems.length > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded-full">
                  {conferredItems.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('relatorio-diario')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'relatorio-diario'
                  ? 'bg-gray-800 text-gray-100 border-b-2 border-orange-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              📊 Relatório Diário
            </button>
            <button
              onClick={() => handleTabChange('actions')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'actions'
                  ? 'bg-gray-800 text-gray-100 border-b-2 border-purple-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              📝 Ações
            </button>
            <button
              onClick={() => handleTabChange('backup')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'backup'
                  ? 'bg-gray-800 text-gray-100 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              💾 Backup
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-8rem)]">
        {activeTab === 'launches' ? (
          <FeatureErrorBoundary feature="LaunchTab">
            <LaunchTab
              currentDate={operationDate ? (() => {
                try {
                const [day, month, year] = operationDate.split('/');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              } catch {
                return new Date();
              }
            })() : new Date()}
            operationDate={operationDate}
            onLaunchAdded={handleLaunchAdded}
            conferredItems={conferredItems}
          />
          </FeatureErrorBoundary>
        ) : activeTab === 'banking' ? (
          <div className="flex h-[calc(100vh-8rem)]">
            {/* Banking Conference Sidebar with Steps */}
            <aside className="w-72 bg-gray-900 border-r border-gray-800 flex-shrink-0 h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4 space-y-4">
            {/* Step 1: Load Spreadsheet */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
                <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">1</span>
                Carregar Planilha
              </h3>
              <div className="space-y-2">
                <input
                  type="file"
                  id="fileInput"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="fileInput"
                  className="block w-full px-3 py-2 text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-md cursor-pointer hover:bg-gray-600 transition-colors text-center"
                  onClick={() => logger.debug('Label clicked')}
                >
                  {selectedFile ? `✅ ${selectedFile.name}` : '📁 Escolher arquivo'}
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={handleLoadFile}
                    disabled={!selectedFile || processingState.isProcessing}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processingState.isProcessing ? 'Processando...' : 'Carregar'}
                  </button>
                  <button
                    onClick={handleClearFile}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Select Day */}
            <DateSelector
              selectedFile={selectedFile}
              onDateSelected={(date, mode) => {
                setOperationDate(date);
                setUploadMode(mode);
              }}
            />

            {/* Step 3: Check Value */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center justify-between">
                <div className="flex items-center">
                  <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">3</span>
                  Conferir Valor
                </div>
                {/* Data status indicator */}
                <div className={`flex items-center text-xs px-2 py-1 rounded-full ${
                  parseResult?.data?.length ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                }`}>
                  {parseResult?.data?.length ? (
                    <>
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {parseResult.data.length} itens
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Sem dados
                    </>
                  )}
                </div>
              </h3>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    ref={conferenceValueRef}
                    id="conference-value-input"
                    type="text"
                    placeholder={!parseResult ? "Carregue uma planilha primeiro" : "Digite o valor (ex: 123,45)"}
                    title={!parseResult ? "É necessário carregar uma planilha na aba 'Conferência Bancária' antes de conferir valores" : "Digite o valor para buscar"}
                    value={dashboardFilters.conferenceValue}
                    onChange={(e) => handleConferenceValueChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleConferenceCheck()}
                    disabled={!parseResult || isSearching}
                    {...useFieldValidation('conference-value-input', searchError)}
                    className={`w-full px-3 py-2 pr-20 text-sm text-gray-100 bg-gray-700 border rounded-md focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      searchError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                  {previewResults !== null && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        previewResults > 0
                          ? 'bg-green-900/50 text-green-400 border border-green-600'
                          : 'bg-red-900/50 text-red-400 border border-red-600'
                      }`}>
                        {previewResults > 0
                          ? `${previewResults} ${previewResults === 1 ? 'resultado' : 'resultados'}`
                          : 'Sem resultados'
                        }
                      </span>
                    </div>
                  )}
                </div>

                <ValidationError error={searchError} fieldId="conference-value-input" />

                <button
                  onClick={handleConferenceCheck}
                  disabled={!parseResult || isSearching || !dashboardFilters.conferenceValue.trim()}
                  className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isSearching ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando...
                    </>
                  ) : (
                    'OK'
                  )}
                </button>
                
                {/* Status Messages */}
                {searchError && (
                  <div className="p-2 bg-red-900/20 border border-red-400 rounded-md">
                    <p className="text-xs text-red-400">{searchError}</p>
                  </div>
                )}
                
                {searchSuccess && (
                  <div className="p-2 bg-green-900/20 border border-green-400 rounded-md">
                    <p className="text-xs text-green-400">{searchSuccess}</p>
                  </div>
                )}
                
                {!parseResult && (
                  <div className="p-2 bg-gray-700 border border-gray-600 rounded-md">
                    <p className="text-xs text-gray-400">Carregue uma planilha para usar esta função</p>
                  </div>
                )}
                <button
                  onClick={handleRestartCurrentDay}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Reiniciar dia atual
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors flex items-center justify-between"
                >
                  <span>Histórico de valores não encontrados</span>
                  <div className="flex items-center space-x-2">
                    {notFoundHistory.length > 0 && (
                      <span className="px-2 py-1 text-xs bg-red-600 text-white rounded-full">
                        {notFoundHistory.length}
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 transform transition-transform ${showHistory ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {showHistory && (
                  <div className="mt-2 p-2 bg-gray-900 rounded-md border border-gray-700 max-h-40 overflow-y-auto">
                    {notFoundHistory.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhum valor não encontrado</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-300">
                            {notFoundHistory.length} valor(es) não encontrado(s)
                          </span>
                          <button
                            onClick={() => setNotFoundHistory([])}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            title="Limpar histórico"
                          >
                            Limpar
                          </button>
                        </div>
                        {notFoundHistory.map((entry, index) => (
                          <div key={index} className="bg-gray-800 rounded p-2 border border-gray-600">
                            <div className="flex justify-between items-start">
                              <span className="text-xs text-gray-200 font-mono">
                                {entry.value}
                              </span>
                              <span className="text-xs text-red-400 bg-red-900/30 px-1 rounded">
                                Não encontrado
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              {new Intl.DateTimeFormat('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).format(entry.timestamp)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: History by Date */}
            <HistoryByDate
              onDataLoaded={(data) => {
                setLoadedHistory(data);
                // Process loaded history to update UI if needed
                const conferredFromHistory = data
                  .filter(entry => entry.operation_type === 'cash_conference' && entry.status === 'conferred')
                  .map(entry => ({
                    ...entry.metadata,
                    conferredAt: (() => {
                      try {
                        const dateStr = entry.conferred_at || entry.operation_timestamp || '';
                        return dateStr ? new Date(dateStr) : new Date();
                      } catch {
                        return new Date();
                      }
                    })(),
                    conferredId: entry.id || `hist-${entry.operation_timestamp}`
                  }));

                if (conferredFromHistory.length > 0) {
                  setFilteredConferredItems(conferredFromHistory);
                  setIsShowingFiltered(true);
                  setActiveTab('cash');
                }
              }}
              onLookupMapBuilt={(entries) => {
                logger.debug(`Building lookup map for ${entries.length} entries...`);
                valueLookup.updateLookupMap(entries);
                logger.debug('Lookup map updated:', valueLookup.stats);
              }}
            />
              </div>
            </aside>

            {/* Banking Conference Main Content Area */}
            <main className="flex-1 bg-gray-950 min-w-0 h-[calc(100vh-8rem)] flex flex-col" style={{ width: 'calc(100vw - 288px)' }}>
              {processingState.isProcessing ? (
                <div className="bg-gray-800 shadow-2xl border border-gray-700 h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-300">Processando arquivo...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-gray-800 shadow-2xl border border-gray-700 min-h-full p-8">
                  <div className="w-full">
                    <div className="bg-red-900/20 border border-red-400 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-400">Erro ao processar arquivo</h3>
                          <div className="mt-2 text-sm text-red-300">
                            <p style={{ whiteSpace: 'pre-line' }}>{error}</p>
                          </div>
                          <div className="mt-4">
                            <button
                              onClick={handleClearFile}
                              className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                            >
                              Tentar novamente
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : parseResult ? (
                <div className="flex-1 overflow-auto min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
                  <div className="bg-gray-800 shadow-2xl border border-gray-700 h-full w-full flex flex-col">
                    {parseResult.warnings.length > 0 && (
                      <div className="bg-yellow-900/20 border-b border-yellow-700 p-4">
                        <div className="flex items-start">
                          <svg className="h-5 w-5 text-yellow-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <div className="ml-3 flex-1">
                            <h3 className="text-sm font-medium text-yellow-400">Avisos encontrados durante o processamento</h3>
                            <div className="mt-2 text-xs text-yellow-300 max-h-20 overflow-y-auto">
                              {parseResult.warnings.slice(0, 5).map((warning, idx) => (
                                <p key={idx}>{warning}</p>
                              ))}
                              {parseResult.warnings.length > 5 && (
                                <p className="mt-1 font-semibold">... e mais {parseResult.warnings.length - 5} avisos</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex-1 overflow-auto min-h-0 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-200">Dados Bancários</h3>
                        <ExportButtons
                          data={{
                            banking: parseResult?.data?.filter(item => !transferredIds.has(item.id)) || []
                          }}
                          prefix="bancario"
                          date={operationDate}
                          disabled={!parseResult?.data?.length}
                        />
                      </div>
                      <FeatureErrorBoundary feature="DataTable">
                        <VirtualizedDataTable parseResult={parseResult} transferredIds={transferredIds} />
                      </FeatureErrorBoundary>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
                  <div className="bg-gray-800 shadow-2xl border border-gray-700 h-full w-full flex flex-col">
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <h3 className="mt-4 text-lg font-medium text-gray-300">
                          Conferência Bancária
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                          Carregue uma planilha para começar a conferir valores.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        ) : activeTab === 'actions' ? (
          /* Action Log Layout */
          <ActionLogPanel className="flex-1" />
        ) : activeTab === 'backup' ? (
          /* Backup Layout */
          <BackupPanel className="flex-1" currentDate={operationDate} />
        ) : activeTab === 'relatorio-diario' ? (
          /* Relatório Diário Layout */
          <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-100 mb-2">📊 Relatório Diário</h2>
                <p className="text-gray-400">Resumo das operações do dia {operationDate}</p>
              </div>

              {/* Resumo de Caixa */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Movimentação de Caixa */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-green-500/20 rounded-lg mr-3">
                      <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200">Caixa</h3>
                      <p className="text-sm text-gray-400">Dinheiro e moedas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Total conferido:</span>
                      <span className="text-green-400 font-medium">
                        {conferredItems.length} item(s)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Valor total:</span>
                      <span className="text-green-400 font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(conferredItems.reduce((sum, item) => sum + (item.value || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dados Bancários */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200">Bancário</h3>
                      <p className="text-sm text-gray-400">Transferências processadas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Total processado:</span>
                      <span className="text-blue-400 font-medium">
                        {parseResult?.stats?.totalRows || 0} item(s)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Transferidos:</span>
                      <span className="text-blue-400 font-medium">
                        {transferredIds.size} item(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status das Operações */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                      <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-200">Status</h3>
                      <p className="text-sm text-gray-400">Resumo das operações</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Data operação:</span>
                      <span className="text-purple-400 font-medium">{operationDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Arquivo carregado:</span>
                      <span className="text-purple-400 font-medium">
                        {parseResult ? '✅ Sim' : '❌ Não'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico de Resumo */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
                <h3 className="text-lg font-semibold text-gray-200 mb-4">📈 Resumo Visual</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Conferência de Caixa */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-md font-medium text-gray-300 mb-3">Conferência de Caixa</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Items conferidos</span>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: conferredItems.length > 0 ? '100%' : '0%' }}
                            ></div>
                          </div>
                          <span className="text-sm text-green-400 font-medium">{conferredItems.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Processamento Bancário */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-md font-medium text-gray-300 mb-3">Processamento Bancário</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Items processados</span>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: parseResult ?
                                  `${Math.min(100, (transferredIds.size / parseResult.stats.totalRows) * 100)}%` :
                                  '0%'
                              }}
                            ></div>
                          </div>
                          <span className="text-sm text-blue-400 font-medium">
                            {parseResult ? `${transferredIds.size}/${parseResult.stats.totalRows}` : '0/0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveTab('banking')}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Ver Conferência Bancária
                </button>
                <button
                  onClick={() => setActiveTab('cash')}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Ver Conferência de Caixa
                </button>
                <button
                  onClick={() => setActiveTab('actions')}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ver Histórico de Ações
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Cash Conference Layout */
          <div className="flex h-[calc(100vh-8rem)]">
            {/* Left Block - Date Filter */}
            <aside className="w-72 bg-gray-900 border-r border-gray-800 flex-shrink-0 h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="p-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-indigo-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Filtrar por Data
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Data específica</label>
                      <input
                        ref={dateFilterRef}
                        type="date"
                        value={dashboardFilters.selectedDate}
                        onChange={(e) => setDashboardFilters(prev => ({ ...prev, selectedDate: e.target.value }))}
                        className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleDateFilter}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Aplicar Filtro
                    </button>
                    <button
                      onClick={() => setDashboardFilters(prev => ({ ...prev, selectedDate: '' }))}
                      className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                    >
                      Limpar Filtro
                    </button>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <h4 className="text-xs font-medium text-gray-400 mb-3">Resumo</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Total de itens:</span>
                        <span className="text-gray-200 font-medium">{conferredItems.length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Valor total:</span>
                        <span className="text-green-400 font-medium">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(conferredItems.reduce((sum, item) => sum + item.value, 0))}
                        </span>
                      </div>
                      {conferredItems.length > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Última conferência:</span>
                          <span className="text-gray-200 font-medium">
                            {new Intl.DateTimeFormat('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(
                              [...conferredItems]
                                .sort((a, b) => b.conferredAt.getTime() - a.conferredAt.getTime())[0]
                                .conferredAt
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Right Block - Transferred Records Table */}
            <main className="flex-1 bg-gray-950 min-w-0 h-[calc(100vh-8rem)] flex flex-col" style={{ width: 'calc(100vw - 288px)' }}>
              <div className="flex-1 overflow-auto min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
                <div className="bg-gray-800 shadow-2xl border border-gray-700 h-full w-full flex flex-col">
                  {isShowingFiltered && (
                    <div className="bg-indigo-900/20 border-b border-indigo-700 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-indigo-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                          </svg>
                          <span className="text-sm font-medium text-indigo-400">
                            Filtrado por: {dashboardFilters.selectedDate &&
                              formatForDisplay(dashboardFilters.selectedDate)
                            }
                          </span>
                        </div>
                        <span className="text-xs text-indigo-300">
                          {filteredConferredItems.length} registro(s)
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-auto min-h-0 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-200">Conferência de Caixa</h3>
                      <ExportButtons
                        data={{
                          cash: isShowingFiltered ? filteredConferredItems : conferredItems
                        }}
                        prefix="caixa"
                        date={operationDate}
                        disabled={(isShowingFiltered ? filteredConferredItems : conferredItems).length === 0}
                      />
                    </div>
                    <FeatureErrorBoundary feature="CashConference">
                      <VirtualizedCashTable
                        conferredItems={isShowingFiltered ? filteredConferredItems : conferredItems}
                        onRemoveItem={handleRemoveConferredItem}
                      />
                    </FeatureErrorBoundary>
                  </div>
                </div>
              </div>
            </main>
          </div>
        )}
      </div>
      
      {/* Value Selection Modal */}
      <ValueSelectionModal
        isOpen={showSelectionModal}
        matches={searchMatches}
        searchValue={searchMatches.length > 0 ? searchMatches[0].value : 0}
        onSelect={handleModalSelection}
        onClose={handleModalClose}
      />

      {/* Restart Confirmation Modal */}
      {showRestartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  Confirmar Reinício
                </h3>
                <p className="text-sm text-gray-300 mb-6">
                  Tem certeza que deseja reiniciar o dia atual? Todos os dados transferidos e históricos serão apagados.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleConfirmRestart}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={handleCancelRestart}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <StorageStatus />

      {/* Development Performance Panel */}
      <DevPerformancePanel
        isVisible={showPerformancePanel}
        onToggle={() => setShowPerformancePanel(!showPerformancePanel)}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />

      {/* Processing Spinner with Cancel Support */}
      <FeatureErrorBoundary feature="ExcelProcessing">
        <ProcessingSpinner
          show={processingState.isProcessing}
          stage={processingState.stage}
        progress={processingState.progress}
        message={processingState.message}
        showStallWarning={processingState.showStallWarning}
        canCancel={processingState.canCancel}
        onCancel={handleCancelProcessing}
        />
      </FeatureErrorBoundary>

      {/* Performance Metrics Dashboard */}
      <MetricsDashboard
        isVisible={showMetricsDashboard}
        onToggle={() => setShowMetricsDashboard(false)}
      />
    </div>
  );
};