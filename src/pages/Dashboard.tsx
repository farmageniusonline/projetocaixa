import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ManipulariumLogo from '../assets/ManipulariumLogo.png';
import { parseExcelFile, ParseResult } from '../utils/excelParser';
import { DataTable } from '../components/DataTable';
import { ValueSelectionModal } from '../components/ValueSelectionModal';
import { CashConferenceTable } from '../components/CashConferenceTable';
import { searchValueMatches, validateValueInput, ValueMatch } from '../utils/valueNormalizer';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'banking' | 'cash'>('banking');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dateMode, setDateMode] = useState<'automatic' | 'manual'>('automatic');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [conferenceValue, setConferenceValue] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Conference states
  const [conferredItems, setConferredItems] = useState<Array<ValueMatch & { conferredAt: Date; conferredId: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMatches, setSearchMatches] = useState<ValueMatch[]>([]);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [transferredIds, setTransferredIds] = useState<Set<string>>(new Set());

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleLoadFile = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      const result = await parseExcelFile(selectedFile);
      const processingTime = Date.now() - startTime;

      if (result.success) {
        setParseResult(result);
        console.log(`Arquivo processado em ${processingTime}ms`);
        console.log(`Linhas processadas: ${result.stats.totalRows}`);
        console.log(`Linhas válidas: ${result.stats.validRows}`);
        console.log(`Avisos: ${result.warnings.length}`);
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
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleDateFilter = () => {
    console.log('Filtrando por data:', filterDate);
    // Implementar lógica de filtro
  };

  // Conference value search and transfer logic
  const handleConferenceCheck = useCallback(async () => {
    if (!parseResult || !parseResult.data) {
      setSearchError('Carregue uma planilha para usar esta função.');
      return;
    }

    const validation = validateValueInput(conferenceValue);
    if (!validation.isValid) {
      setSearchError(validation.error || 'Valor inválido');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      const searchResult = searchValueMatches(conferenceValue, parseResult.data);
      
      if (!searchResult.hasMatches) {
        setSearchError('Valor não encontrado nos dados carregados.');
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
  }, [conferenceValue, parseResult, conferredItems]);

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
  }, []);

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
                >
                  {selectedFile ? selectedFile.name : 'Escolher arquivo'}
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={handleLoadFile}
                    disabled={!selectedFile}
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Carregar
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
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
                <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">2</span>
                Selecionar Dia
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="dateMode"
                      value="automatic"
                      checked={dateMode === 'automatic'}
                      onChange={() => setDateMode('automatic')}
                      className="mr-2 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-300">Data Automática</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="dateMode"
                      value="manual"
                      checked={dateMode === 'manual'}
                      onChange={() => setDateMode('manual')}
                      className="mr-2 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-300">Selecionar Manualmente</span>
                  </label>
                </div>
                {dateMode === 'manual' && (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                )}
              </div>
            </div>

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
                  value={conferenceValue}
                  onChange={(e) => handleConferenceValueChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleConferenceCheck()}
                  disabled={!parseResult || isSearching}
                  className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleConferenceCheck}
                  disabled={!parseResult || isSearching || !conferenceValue.trim()}
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
                  className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Reiniciar dia atual
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors flex items-center justify-between"
                >
                  <span>Histórico de valores não encontrados</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${showHistory ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showHistory && (
                  <div className="mt-2 p-2 bg-gray-900 rounded-md border border-gray-700">
                    <p className="text-xs text-gray-400">Nenhum valor não encontrado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Filter by Date */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
                <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">4</span>
                Filtrar por Data
              </h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="dd/mm/aaaa"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleDateFilter}
                  className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Localizar Dia
                </button>
              </div>
                </div>
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
                  <DataTable data={parseResult.data} stats={parseResult.stats} />
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
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
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
                      onClick={() => setFilterDate('')}
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
                <CashConferenceTable 
                  conferredItems={conferredItems} 
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
    </div>
  );
};