import React, { useState, useEffect, useMemo } from 'react';
import { smartValueSearch, FuzzyMatch, getRecentSearchSuggestions, saveRecentSearch } from '../utils/fuzzySearch';
import { ParsedRow } from '../utils/excelParser';
import { sanitizeInput } from '../utils/input-sanitization';

interface FuzzySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: (ParsedRow & { id?: string })[];
  transferredIds: Set<string>;
  onSelect: (match: FuzzyMatch) => void;
  initialSearchValue?: string;
}

export const FuzzySearchModal: React.FC<FuzzySearchModalProps> = ({
  isOpen,
  onClose,
  data,
  transferredIds,
  onSelect,
  initialSearchValue = ''
}) => {
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'exact' | 'close' | 'fuzzy'>('exact');

  const searchResults = useMemo(() => {
    if (!searchValue.trim()) return { exactMatches: [], closeMatches: [], fuzzyMatches: [], suggestions: [] };

    setIsSearching(true);
    const results = smartValueSearch(searchValue, data, transferredIds);
    setIsSearching(false);

    return results;
  }, [searchValue, data, transferredIds]);

  const recentSearches = getRecentSearchSuggestions();

  useEffect(() => {
    if (isOpen && initialSearchValue) {
      setSearchValue(initialSearchValue);
    }
  }, [isOpen, initialSearchValue]);

  const handleSearch = (value: string) => {
    // Sanitize search input before processing
    const sanitizedValue = sanitizeInput(value, {
      type: 'text',
      maxLength: 100,
      strictMode: true
    });

    setSearchValue(sanitizedValue);
    if (sanitizedValue.trim()) {
      saveRecentSearch(sanitizedValue);
    }
  };

  const handleSelect = (match: FuzzyMatch) => {
    onSelect(match);
    onClose();
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'Alta';
    if (confidence >= 0.6) return 'Média';
    return 'Baixa';
  };

  const renderMatches = (matches: FuzzyMatch[], title: string, emptyMessage: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-300 flex items-center">
        {title}
        <span className="ml-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full">
          {matches.length}
        </span>
      </h4>

      {matches.length === 0 ? (
        <p className="text-xs text-gray-500 italic">{emptyMessage}</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {matches.map((match, index) => (
            <div
              key={`${match.item.id || index}-${match.item.value}`}
              className="p-3 bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-650 cursor-pointer transition-colors"
              onClick={() => handleSelect(match)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-100">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(match.item.value)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {match.item.date} • {match.item.paymentType}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-medium ${getConfidenceColor(match.confidence)}`}>
                    {getConfidenceLabel(match.confidence)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(match.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-400 mb-2">
                {match.matchReason}
              </div>

              <div className="text-xs text-gray-500 truncate">
                {match.item.originalHistory}
              </div>

              {match.item.cpf && (
                <div className="text-xs text-gray-500 mt-1">
                  CPF: {match.item.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-100">Busca Inteligente</h3>
            <p className="text-sm text-gray-400">Encontre valores usando busca aproximada e padrões</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Digite um valor, parte do histórico ou CPF..."
              className="w-full px-4 py-3 pl-10 text-lg text-gray-100 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>

          {/* Recent Searches & Suggestions */}
          {!searchValue && recentSearches.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">Buscas recentes:</div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((recent, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(recent)}
                    className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition-colors"
                  >
                    {recent}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Suggestions */}
          {searchValue && searchResults.suggestions.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-2">Sugestões:</div>
              <div className="flex flex-wrap gap-2">
                {searchResults.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(suggestion)}
                    className="px-3 py-1 text-xs bg-indigo-700 text-gray-300 rounded-full hover:bg-indigo-600 transition-colors"
                  >
                    R$ {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        {searchValue && (
          <div className="flex space-x-1 mb-6 border-b border-gray-700">
            <button
              onClick={() => setSelectedTab('exact')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                selectedTab === 'exact'
                  ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              Exatos ({searchResults.exactMatches.length})
            </button>
            <button
              onClick={() => setSelectedTab('close')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                selectedTab === 'close'
                  ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              Próximos ({searchResults.closeMatches.length})
            </button>
            <button
              onClick={() => setSelectedTab('fuzzy')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                selectedTab === 'fuzzy'
                  ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
              }`}
            >
              Similares ({searchResults.fuzzyMatches.length})
            </button>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!searchValue ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h4 className="text-lg font-medium text-gray-300 mb-2">Busca Inteligente</h4>
              <p className="text-gray-500 max-w-md mx-auto">
                Digite um valor, parte do histórico ou CPF para encontrar registros similares usando algoritmos avançados de busca.
              </p>
              <div className="mt-6 text-xs text-gray-600">
                <p><strong>Dicas:</strong></p>
                <p>• Use valores aproximados (ex: 150.00 pode encontrar 149.99)</p>
                <p>• Digite parte do histórico da transação</p>
                <p>• Use CPF parcial para buscar por pessoa</p>
              </div>
            </div>
          ) : (
            <div>
              {selectedTab === 'exact' && renderMatches(
                searchResults.exactMatches,
                'Correspondências Exatas',
                'Nenhuma correspondência exata encontrada'
              )}
              {selectedTab === 'close' && renderMatches(
                searchResults.closeMatches,
                'Correspondências Próximas',
                'Nenhuma correspondência próxima encontrada'
              )}
              {selectedTab === 'fuzzy' && renderMatches(
                searchResults.fuzzyMatches,
                'Correspondências Similares',
                'Nenhuma correspondência similar encontrada'
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Pressione <kbd className="px-1 bg-gray-700 rounded">Esc</kbd> para fechar
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};