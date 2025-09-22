import React, { useState, useMemo } from 'react';
import { db, ActionLog } from '../lib/indexeddb';
import { formatToDDMMYYYY, formatForDateInput, formatDateTimeForDisplay } from '../utils/dateFormatter';
import { VirtualizedList } from './VirtualizedList';
import { ExportButtons } from './ExportButtons';

interface ActionLogPanelProps {
  className?: string;
}

export const ActionLogPanel: React.FC<ActionLogPanelProps> = ({ className = '' }) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    formatForDateInput(new Date())
  );
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');

  const loadActionLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const formattedDate = formatToDDMMYYYY(selectedDate);
      const query = db.action_log.where('day').equals(formattedDate);

      const logs = await query.toArray();

      // Sort by timestamp descending (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActionLogs(logs);

      if (logs.length === 0) {
        setError('Nenhuma ação encontrada para a data selecionada.');
      }
    } catch (err) {
      console.error('Error loading action logs:', err);
      setError('Erro ao carregar histórico de ações. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered logs based on type and result filters
  const filteredLogs = useMemo(() => {
    return actionLogs.filter(log => {
      const typeMatch = filterType === 'all' || log.action_type === filterType;
      const resultMatch = filterResult === 'all' || log.result === filterResult;
      return typeMatch && resultMatch;
    });
  }, [actionLogs, filterType, filterResult]);

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'banking_upload':
        return 'Upload Bancário';
      case 'cash_conference':
        return 'Conferência';
      case 'manual_entry':
        return 'Lançamento Manual';
      case 'transfer':
        return 'Transferência';
      case 'undo':
        return 'Desfazer';
      case 'not_found':
        return 'Não Encontrado';
      default:
        return type;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'success':
        return (
          <span className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-600 rounded">
            Sucesso
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-600 rounded">
            Erro
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-600 rounded">
            Aviso
          </span>
        );
      default:
        return null;
    }
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Nenhum dado para exportar.');
      return;
    }

    const headers = [
      'Data/Hora',
      'Tipo de Ação',
      'Descrição',
      'Resultado',
      'Usuário',
      'Valores',
      'IDs de Origem',
      'Erro'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        `"${formatDateTimeForDisplay(log.timestamp)}"`,
        `"${getActionTypeLabel(log.action_type)}"`,
        `"${log.action_description.replace(/"/g, '""')}"`,
        `"${log.result}"`,
        `"${log.user_id}"`,
        `"${log.payload.values?.join('; ') || ''}"`,
        `"${log.payload.source_ids?.join('; ') || ''}"`,
        `"${log.error_message || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico_acoes_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderLogItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = filteredLogs[index];

    return (
      <div
        style={style}
        className="flex items-start space-x-3 p-3 border-b border-gray-700 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex-shrink-0 mt-1">
          {getResultBadge(log.result)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-medium text-gray-200 truncate">
              {getActionTypeLabel(log.action_type)}
            </h4>
            <span className="text-xs text-gray-400">
              {formatDateTimeForDisplay(log.timestamp)}
            </span>
          </div>

          <p className="text-sm text-gray-300 mb-2">
            {log.action_description}
          </p>

          {log.payload.values && log.payload.values.length > 0 && (
            <div className="text-xs text-gray-400 mb-1">
              Valores: {log.payload.values.map(v =>
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(v)
              ).join(', ')}
            </div>
          )}

          {log.payload.source_ids && log.payload.source_ids.length > 0 && (
            <div className="text-xs text-gray-400 mb-1">
              IDs: {log.payload.source_ids.slice(0, 2).join(', ')}
              {log.payload.source_ids.length > 2 && ` +${log.payload.source_ids.length - 2} mais`}
            </div>
          )}

          {log.error_message && (
            <div className="text-xs text-red-400 mt-1 p-2 bg-red-900/20 rounded">
              Erro: {log.error_message}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
        <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">
          📝
        </span>
        Histórico de Ações
      </h3>

      <div className="space-y-3">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="action-date-input" className="block text-xs text-gray-400 mb-1">
              Data
            </label>
            <input
              id="action-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div>
            <label htmlFor="action-type-filter" className="block text-xs text-gray-400 mb-1">
              Tipo de Ação
            </label>
            <select
              id="action-type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">Todas</option>
              <option value="banking_upload">Upload Bancário</option>
              <option value="cash_conference">Conferência</option>
              <option value="manual_entry">Lançamento Manual</option>
              <option value="transfer">Transferência</option>
              <option value="undo">Desfazer</option>
              <option value="not_found">Não Encontrado</option>
            </select>
          </div>

          <div>
            <label htmlFor="result-filter" className="block text-xs text-gray-400 mb-1">
              Resultado
            </label>
            <select
              id="result-filter"
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">Todos</option>
              <option value="success">Sucesso</option>
              <option value="error">Erro</option>
              <option value="warning">Aviso</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={loadActionLogs}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Carregando...' : 'Carregar Histórico'}
          </button>

          <ExportButtons
            data={{ actions: filteredLogs }}
            prefix="acoes"
            date={formatToDDMMYYYY(selectedDate)}
            disabled={filteredLogs.length === 0}
          />

          <button
            onClick={() => {
              const today = formatForDateInput(new Date());
              setSelectedDate(today);
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

        {/* Summary */}
        {filteredLogs.length > 0 && (
          <div className="bg-gray-900 rounded p-3 border border-gray-600">
            <h4 className="text-xs font-medium text-gray-400 mb-2">Resumo</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total:</span>
                <span className="text-gray-200">{filteredLogs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sucessos:</span>
                <span className="text-green-400">
                  {filteredLogs.filter(log => log.result === 'success').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Erros:</span>
                <span className="text-red-400">
                  {filteredLogs.filter(log => log.result === 'error').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avisos:</span>
                <span className="text-yellow-400">
                  {filteredLogs.filter(log => log.result === 'warning').length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Virtualized Action Logs List */}
        {filteredLogs.length > 0 && (
          <div className="bg-gray-900 rounded border border-gray-600">
            <VirtualizedList
              items={filteredLogs}
              itemHeight={120}
              height={400}
              renderItem={renderLogItem}
              className="custom-scrollbar"
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};