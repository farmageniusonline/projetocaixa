import React, { useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Eye, Download, Filter } from 'lucide-react';
import { ConferenceHistoryEntry } from '../services/indexedDbService';
import { useHistoryTableSelectors, TableFilters } from '../hooks/useTableSelectors';
import { usePersistentState } from '../hooks/usePersistentState';

interface VirtualizedHistoryTableProps {
  historyData: ConferenceHistoryEntry[];
  onExport?: () => void;
  className?: string;
}

// Memoized row component to prevent unnecessary re-renders
const HistoryTableRow = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    items: ConferenceHistoryEntry[];
  };
}>(({ index, style, data }) => {
  const entry = data.items[index];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const getOperationTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'banking_upload': 'bg-blue-900 text-blue-200',
      'cash_conference': 'bg-green-900 text-green-200',
      'not_found': 'bg-red-900 text-red-200',
      'manual_entry': 'bg-purple-900 text-purple-200',
    };

    const labels: Record<string, string> = {
      'banking_upload': 'Upload Bancário',
      'cash_conference': 'Conf. Caixa',
      'not_found': 'Não Encontrado',
      'manual_entry': 'Lançamento Manual',
    };

    const colorClass = colors[type] || 'bg-gray-700 text-gray-300';
    const label = labels[type] || type;

    return (
      <span className={`px-2 py-1 text-xs rounded ${colorClass}`}>
        {label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-yellow-900 text-yellow-200',
      'conferred': 'bg-green-900 text-green-200',
      'not_found': 'bg-red-900 text-red-200',
      'transferred': 'bg-blue-900 text-blue-200',
      'active': 'bg-green-900 text-green-200',
      'cancelled': 'bg-gray-700 text-gray-300',
    };

    const labels: Record<string, string> = {
      'pending': 'Pendente',
      'conferred': 'Conferido',
      'not_found': 'Não Encontrado',
      'transferred': 'Transferido',
      'active': 'Ativo',
      'cancelled': 'Cancelado',
    };

    const colorClass = colors[status] || 'bg-gray-700 text-gray-300';
    const label = labels[status] || status;

    return (
      <span className={`px-2 py-1 text-xs rounded ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div
      style={style}
      className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-700 text-sm ${
        index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'
      } hover:bg-gray-800 transition-colors`}
    >
      {/* Index */}
      <div className="col-span-1 text-gray-400 font-mono flex items-center">
        {index + 1}
      </div>

      {/* Date */}
      <div className="col-span-2 text-gray-300 flex items-center">
        <span className="text-xs">
          {entry.operation_date}
        </span>
      </div>

      {/* Operation Type */}
      <div className="col-span-2 flex items-center">
        {getOperationTypeBadge(entry.operation_type || 'unknown')}
      </div>

      {/* Value */}
      <div className="col-span-2 text-right font-semibold flex items-center justify-end">
        {entry.value ? (
          <span className={entry.value >= 0 ? 'text-green-400' : 'text-red-400'}>
            {formatCurrency(entry.value)}
          </span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>

      {/* Status */}
      <div className="col-span-2 flex items-center">
        {getStatusBadge(entry.status || 'unknown')}
      </div>

      {/* Description */}
      <div className="col-span-2 text-gray-300 flex items-center">
        <span className="truncate" title={entry.description}>
          {entry.description || '-'}
        </span>
      </div>

      {/* Timestamp */}
      <div className="col-span-1 text-gray-400 flex items-center">
        <span className="text-xs">
          {formatDateTime(entry.operation_timestamp)}
        </span>
      </div>
    </div>
  );
});

HistoryTableRow.displayName = 'HistoryTableRow';

export const VirtualizedHistoryTable: React.FC<VirtualizedHistoryTableProps> = ({
  historyData,
  onExport,
  className = ''
}) => {
  // Filters state
  const [filters, setFilters] = usePersistentState<TableFilters>('history_table_filters', {
    dateFilter: '',
    typeFilter: 'all',
    statusFilter: 'all',
    searchText: '',
  });

  // Use memoized selectors
  const { filteredData, stats, isEmpty, hasFilters } = useHistoryTableSelectors(
    historyData,
    filters
  );

  // Memoized filter options
  const filterOptions = useMemo(() => {
    const operationTypes = [...new Set(historyData.map(entry => entry.operation_type || 'unknown'))].sort();
    const statuses = [...new Set(historyData.map(entry => entry.status || 'unknown'))].sort();
    return { operationTypes, statuses };
  }, [historyData]);

  // Memoized data for the virtual list
  const listData = useMemo(() => ({
    items: filteredData
  }), [filteredData]);

  const handleFilterChange = useCallback((key: keyof TableFilters, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, [setFilters]);

  const clearFilters = useCallback(() => {
    setFilters({
      dateFilter: '',
      typeFilter: 'all',
      statusFilter: 'all',
      searchText: '',
    });
  }, [setFilters]);

  const ROW_HEIGHT = 70;
  const TABLE_HEIGHT = Math.min(600, Math.max(300, filteredData.length * ROW_HEIGHT + 50));

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg ${className}`}>
      {/* Header with stats and filters */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-200 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Histórico de Operações
          </h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Total: {stats.totalItems}</span>
              <span>Filtrados: {stats.filteredCount}</span>
              <span>Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.filteredValue)}</span>
            </div>
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center px-3 py-2 text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar..."
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Date Filter */}
          <input
            type="text"
            placeholder="Data (DD-MM-YYYY)"
            value={filters.dateFilter}
            onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Operation Type Filter */}
          <select
            value={filters.typeFilter}
            onChange={(e) => handleFilterChange('typeFilter', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os tipos</option>
            {filterOptions.operationTypes.map(type => (
              <option key={type} value={type}>
                {type === 'banking_upload' ? 'Upload Bancário' :
                 type === 'cash_conference' ? 'Conf. Caixa' :
                 type === 'not_found' ? 'Não Encontrado' :
                 type === 'manual_entry' ? 'Lançamento Manual' : type}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.statusFilter}
            onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os status</option>
            {filterOptions.statuses.map(status => (
              <option key={status} value={status}>
                {status === 'pending' ? 'Pendente' :
                 status === 'conferred' ? 'Conferido' :
                 status === 'not_found' ? 'Não Encontrado' :
                 status === 'transferred' ? 'Transferido' :
                 status === 'active' ? 'Ativo' :
                 status === 'cancelled' ? 'Cancelado' : status}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center justify-center px-3 py-2 text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
            >
              <Filter className="h-4 w-4 mr-1" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-750 border-b border-gray-700 text-sm font-semibold text-gray-300">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Data</div>
        <div className="col-span-2">Tipo</div>
        <div className="col-span-2 text-right">Valor</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Descrição</div>
        <div className="col-span-1">Timestamp</div>
      </div>

      {/* Virtualized Table Body */}
      {isEmpty ? (
        <div className="p-8 text-center text-gray-400">
          {hasFilters ? 'Nenhum resultado encontrado com os filtros aplicados' : 'Nenhum histórico disponível'}
        </div>
      ) : (
        <List
          height={TABLE_HEIGHT}
          itemCount={filteredData.length}
          itemSize={ROW_HEIGHT}
          itemData={listData}
          className="custom-scrollbar"
        >
          {HistoryTableRow}
        </List>
      )}

      {/* Footer with additional stats */}
      {!isEmpty && (
        <div className="p-3 border-t border-gray-700 bg-gray-750">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <div className="flex space-x-4">
              <span>
                Média: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.averageValue)}
              </span>
            </div>
            <div className="flex space-x-4">
              {Object.entries(stats.itemsByStatus).slice(0, 4).map(([status, count]) => (
                <span key={status}>
                  {status === 'pending' ? 'Pendente' :
                   status === 'conferred' ? 'Conferido' :
                   status === 'not_found' ? 'Não Encontrado' :
                   status === 'active' ? 'Ativo' : status}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};