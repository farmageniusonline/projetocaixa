import React, { useState } from 'react';
import StorageAdapter from '../lib/storageAdapter';
import { ConferenceHistoryEntry, DailyOperationsSummary } from '../services/indexedDbService';
import { formatToDDMMYYYY, formatForDateInput, formatDateTimeForDisplay } from '../utils/dateFormatter';
import { VirtualizedHistoryTable } from './VirtualizedHistoryTable';
import { ExportButtons } from './ExportButtons';

interface HistoryByDateProps {
  className?: string;
  onDataLoaded?: (data: ConferenceHistoryEntry[]) => void;
  onLookupMapBuilt?: (entries: ConferenceHistoryEntry[]) => void;
}

export const HistoryByDate: React.FC<HistoryByDateProps> = ({
  className = '',
  onDataLoaded,
  onLookupMapBuilt
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    formatForDateInput(new Date())
  );
  const [historyData, setHistoryData] = useState<ConferenceHistoryEntry[]>([]);
  const [dailySummary, setDailySummary] = useState<DailyOperationsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('day');

  const loadHistoryData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let data: ConferenceHistoryEntry[] = [];

      if (dateRange === 'day') {
        // Load single day data - convert to DD-MM-YYYY format
        const formattedDate = formatToDDMMYYYY(selectedDate);
        data = await StorageAdapter.getHistoryByDate(formattedDate);
        const summary = await StorageAdapter.getDailySummary(formattedDate);
        setDailySummary(summary);
      } else {
        // Calculate date range
        const endDate = new Date(selectedDate);
        const startDate = new Date(selectedDate);

        if (dateRange === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (dateRange === 'month') {
          startDate.setMonth(startDate.getMonth() - 1);
        }

        data = await StorageAdapter.getHistoryByDateRange(
          formatToDDMMYYYY(startDate),
          formatToDDMMYYYY(endDate)
        );
        setDailySummary(null); // No summary for range
      }

      setHistoryData(data);

      if (onDataLoaded) {
        onDataLoaded(data);
      }

      // Build lookup map for O(1) value searches
      if (data.length > 0) {
        onLookupMapBuilt?.(data);
      }

      if (data.length === 0) {
        setError('Nenhum registro encontrado para o período selecionado.');
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setError('Erro ao carregar histórico. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case 'banking_upload':
        return 'Upload Bancário';
      case 'cash_conference':
        return 'Conferência de Caixa';
      case 'not_found':
        return 'Não Encontrado';
      default:
        return type;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'conferred':
        return (
          <span className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-600 rounded">
            Conferido
          </span>
        );
      case 'not_found':
        return (
          <span className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-600 rounded">
            Não Encontrado
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-600 rounded">
            Pendente
          </span>
        );
      default:
        return null;
    }
  };

  const groupHistoryByType = () => {
    const grouped: Record<string, ConferenceHistoryEntry[]> = {
      banking_upload: [],
      cash_conference: [],
      not_found: []
    };

    historyData.forEach(entry => {
      if (grouped[entry.operation_type]) {
        grouped[entry.operation_type].push(entry);
      }
    });

    return grouped;
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
        <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">
          4
        </span>
        Histórico por Data
      </h3>

      <div className="space-y-3">
        {/* Date and Range Selection */}
        <div className="space-y-2">
          <div>
            <label htmlFor="history-date-input" className="block text-xs text-gray-400 mb-1">
              Selecionar data
            </label>
            <input
              id="history-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Selecionar data"
            />
          </div>

          <div>
            <label htmlFor="period-select" className="block text-xs text-gray-400 mb-1">
              Período
            </label>
            <select
              id="period-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'day' | 'week' | 'month')}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Selecionar período"
            >
              <option value="day">Dia específico</option>
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={loadHistoryData}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Carregando...' : 'Carregar Histórico'}
          </button>
          <button
            onClick={() => {
              const today = formatForDateInput(new Date());
              setSelectedDate(today);
              setDateRange('day');
            }}
            className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
            title="Carregar dia atual"
          >
            Hoje
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-2 bg-red-900/20 border border-red-400 rounded-md">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Daily Summary */}
        {dailySummary && (
          <div className="bg-gray-900 rounded p-3 border border-gray-600">
            <h4 className="text-xs font-medium text-gray-400 mb-2">Resumo do Dia</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Uploads:</span>
                <span className="text-gray-200">{dailySummary.banking_total_uploaded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Conferidos:</span>
                <span className="text-green-400">{dailySummary.total_conferred || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Não encontrados:</span>
                <span className="text-red-400">{dailySummary.cash_not_found_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Valor total:</span>
                <span className="text-indigo-400">
                  {formatCurrency(dailySummary.total_value || 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Virtualized History Table */}
        {historyData.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-gray-200">Dados do Histórico</h4>
              <ExportButtons
                data={{ history: historyData }}
                prefix="historico"
                date={formatToDDMMYYYY(selectedDate)}
                disabled={historyData.length === 0}
              />
            </div>
            <VirtualizedHistoryTable
              historyData={historyData}
              onExport={() => {}}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};