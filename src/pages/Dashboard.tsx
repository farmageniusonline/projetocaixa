import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ManipulariumLogo from '../assets/ManipulariumLogo.png';
import { parseExcelFile, ParseResult } from '../utils/excelParser';
import { DataTable } from '../components/DataTable';
import { ValueSelectionModal } from '../components/ValueSelectionModal';
import { CashConferenceTable } from '../components/CashConferenceTable';
import { DateSelector } from '../components/DateSelector';
import { HistoryByDate } from '../components/HistoryByDate';
import { searchValueMatches, validateValueInput, ValueMatch } from '../utils/valueNormalizer';
import { useDashboardFilters, usePersistentState } from '../hooks/usePersistentState';
import { ConferenceHistoryService, ConferenceHistoryEntry } from '../services/conferenceHistory';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  // Persistent state hooks
  const [dashboardFilters, setDashboardFilters] = useDashboardFilters();
  const [activeTab, setActiveTab] = usePersistentState<'banking' | 'cash'>('dashboard_active_tab', 'banking');
  const [showHistory, setShowHistory] = usePersistentState('dashboard_show_history', false);

  // Local state (non-persistent)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [operationDate, setOperationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [uploadMode, setUploadMode] = useState<'automatic' | 'manual'>('automatic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedHistory, setLoadedHistory] = useState<ConferenceHistoryEntry[]>([]);

  // Persistent state for parsed data
  const [parseResult, setParseResult] = usePersistentState<ParseResult | null>('dashboard_parse_result', null);
  
  // Conference states - persistent
  const [conferredItems, setConferredItems] = usePersistentState<Array<ValueMatch & { conferredAt: Date; conferredId: string }>>('dashboard_conferred_items', []);
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
    deserialize: (value) => JSON.parse(value).map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) }))
  });

  // Conference states - non-persistent
  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<ValueMatch[]>([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [showRestartModal, setShowRestartModal] = useState(false);

  // Historical data filtering states
  const [filteredConferredItems, setFilteredConferredItems] = useState<Array<ValueMatch & { conferredAt: Date; conferredId: string }>>([]);
  const [isShowingFiltered, setIsShowingFiltered] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('File selected:', file);
    if (file) {
      console.log('File details:', { name: file.name, size: file.size, type: file.type });
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleLoadFile = async () => {
    console.log('handleLoadFile called, selectedFile:', selectedFile);
    if (!selectedFile) {
      console.log('No file selected');
      return;
    }

    console.log('Starting file processing...');
    setIsLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      console.log('Calling parseExcelFile...');
      const result = await parseExcelFile(selectedFile);
      console.log('parseExcelFile result:', result);
      const processingTime = Date.now() - startTime;

      if (result.success) {
        setParseResult(result);
        console.log(`Arquivo processado em ${processingTime}ms`);
        console.log(`Linhas processadas: ${result.stats.totalRows}`);
        console.log(`Linhas válidas: ${result.stats.validRows}`);
        console.log(`Avisos: ${result.warnings.length}`);

        // Save to database
        try {
          await ConferenceHistoryService.saveBankingUpload(
            result.data,
            selectedFile.name,
            operationDate,
            uploadMode
          );
          console.log('Data saved to database successfully');
        } catch (dbError) {
          console.error('Error saving to database:', dbError);
          // Don't fail the entire operation if DB save fails
        }
      } else {
        setError(result.errors.join('\n'));
        setParseResult(null);
      }
    } catch (err) {
      setError(`Erro ao processar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setParseResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setParseResult(null);
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

    console.log('Carregando histórico para data:', dashboardFilters.selectedDate);

    try {
      const selectedDate = new Date(dashboardFilters.selectedDate);
      const dateString = selectedDate.toLocaleDateString('pt-BR');

      // Filter conferred items by selected date
      const conferredForDate = conferredItems.filter(item => {
        const itemDate = new Date(item.conferredAt);
        return itemDate.toDateString() === selectedDate.toDateString();
      });

      // Filter not found history by selected date
      const notFoundForDate = notFoundHistory.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate.toDateString() === selectedDate.toDateString();
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
      console.error('Erro ao filtrar por data:', error);
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

  // Conference value search and transfer logic
  const handleConferenceCheck = useCallback(async () => {
    if (!parseResult || !parseResult.data) {
      setSearchError('Carregue uma planilha para usar esta função.');
      return;
    }

    const validation = validateValueInput(dashboardFilters.conferenceValue);
    if (!validation.isValid) {
      setSearchError(validation.error || 'Valor inválido');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      const searchResult = searchValueMatches(dashboardFilters.conferenceValue, parseResult.data);
      
      if (!searchResult.hasMatches) {
        // Parse and format value as Brazilian currency
        const numericValue = parseFloat(dashboardFilters.conferenceValue.replace(',', '.').replace(/[^\d.-]/g, ''));
        const formattedValue = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(isNaN(numericValue) ? 0 : numericValue);
        
        // Save to not found history with formatted value
        const notFoundEntry = {
          value: formattedValue,
          timestamp: new Date(),
          status: 'not_found' as const
        };
        setNotFoundHistory(prev => [notFoundEntry, ...prev]);

        // Save to database
        try {
          await ConferenceHistoryService.saveNotFound(
            dashboardFilters.conferenceValue,
            operationDate
          );
        } catch (dbError) {
          console.error('Error saving not found to database:', dbError);
        }

        // Show error message
        setSearchError('Valor não encontrado nos dados carregados.');
        
        // Show success toast for saving to history
        setSearchSuccess('Valor salvo no histórico de não encontrados.');
        setTimeout(() => setSearchSuccess(null), 3000);
        
        // Clear input and focus
        setConferenceValue('');
        setTimeout(() => {
          const input = document.querySelector('input[placeholder*="Digite o valor"]') as HTMLInputElement;
          if (input) {
            input.focus();
            input.select();
          }
        }, 100);
        
        setIsSearching(false);
        return;
      }

      // Filter out already conferred items
      const availableMatches = searchResult.matches.filter(match => 
        !conferredItems.some(conferred => conferred.id === match.id)
      );

      if (availableMatches.length === 0) {
        setSearchError('Este valor já foi conferido.');
        setIsSearching(false);
        return;
      }

      if (availableMatches.length === 1) {
        // Single match - transfer automatically
        await transferToConference(availableMatches[0]);
      } else {
        // Multiple matches - show selection modal
        setSearchMatches(availableMatches);
        setShowSelectionModal(true);
      }
    } catch (error) {
      setSearchError('Erro ao buscar valor. Tente novamente.');
    } finally {
      setIsSearching(false);
    }
  }, [dashboardFilters.conferenceValue, parseResult, conferredItems, operationDate]);

  const transferToConference = useCallback(async (match: ValueMatch) => {
    const conferredId = `conf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const conferredItem = {
      ...match,
      conferredAt: new Date(),
      conferredId,
    };

    // Add to conferred items
    setConferredItems(prev => [...prev, conferredItem]);

    // Mark as transferred to remove from banking table
    setTransferredIds(prev => new Set([...prev, match.id]));

    // Save to database
    try {
      await ConferenceHistoryService.saveCashConference(
        match,
        operationDate,
        'conferred'
      );
    } catch (dbError) {
      console.error('Error saving conference to database:', dbError);
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
  }, [operationDate]);

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
    }
  }, [conferredItems]);

  // Clear messages when switching tabs or changing values
  const handleTabChange = (tab: 'banking' | 'cash') => {
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
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-8rem)]">
        {activeTab === 'banking' ? (
          <>
            {/* Banking Conference Sidebar with Steps */}
            <aside className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto">
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
                  onClick={() => console.log('Label clicked')}
                >
                  {selectedFile ? `✅ ${selectedFile.name}` : '📁 Escolher arquivo'}
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={handleLoadFile}
                    disabled={!selectedFile || isLoading}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? 'Processando...' : 'Carregar'}
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
              <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
                <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">3</span>
                Conferir Valor
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Digite o valor (ex: 123,45)"
                  value={dashboardFilters.conferenceValue}
                  onChange={(e) => handleConferenceValueChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleConferenceCheck()}
                  disabled={!parseResult || isSearching}
                  className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
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
                    conferredAt: new Date(entry.conferred_at || entry.operation_timestamp || ''),
                    conferredId: entry.id || `hist-${entry.operation_timestamp}`
                  }));

                if (conferredFromHistory.length > 0) {
                  setFilteredConferredItems(conferredFromHistory);
                  setIsShowingFiltered(true);
                  setActiveTab('cash');
                }
              }}
            />
              </div>
            </aside>

            {/* Banking Conference Main Content Area */}
            <main className="flex-1 bg-gray-950 p-6 overflow-hidden">
              {isLoading ? (
                <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 min-h-full p-8 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="animate-spin h-12 w-12 text-indigo-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-300">Processando arquivo...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 min-h-full p-8">
                  <div className="max-w-md mx-auto">
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
                <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 h-full flex flex-col">
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
                  <DataTable data={parseResult.data} stats={parseResult.stats} transferredIds={transferredIds} />
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 min-h-full p-8">
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
              )}
            </main>
          </>
        ) : (
          /* Cash Conference Layout */
          <div className="flex w-full h-full">
            {/* Left Block - Date Filter */}
            <aside className="w-80 bg-gray-900 border-r border-gray-800 overflow-y-auto">
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
            <main className="flex-1 bg-gray-950 p-6 overflow-hidden">
              <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 h-full">
                {isShowingFiltered && (
                  <div className="bg-indigo-900/20 border-b border-indigo-700 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-indigo-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        <span className="text-sm font-medium text-indigo-400">
                          Filtrado por: {dashboardFilters.selectedDate &&
                            new Date(dashboardFilters.selectedDate).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })
                          }
                        </span>
                      </div>
                      <span className="text-xs text-indigo-300">
                        {filteredConferredItems.length} registro(s)
                      </span>
                    </div>
                  </div>
                )}
                <CashConferenceTable
                  conferredItems={isShowingFiltered ? filteredConferredItems : conferredItems}
                  onRemoveItem={handleRemoveConferredItem}
                />
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
    </div>
  );
};