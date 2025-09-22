import React, { useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Trash2, Clock } from 'lucide-react';
import { ValueMatch } from '../utils/valueNormalizer';
import { useCashTableSelectors, TableFilters } from '../hooks/useTableSelectors';
import { usePersistentState } from '../hooks/usePersistentState';

interface VirtualizedCashTableProps {
  conferredItems: Array<ValueMatch & { conferredAt: Date; conferredId: string }>;
  onRemoveItem: (conferredId: string) => void;
  className?: string;
}

// Memoized row component to prevent unnecessary re-renders
const CashTableRow = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    items: Array<ValueMatch & { conferredAt: Date; conferredId: string }>;
    onRemoveItem: (conferredId: string) => void;
  };
}>(({ index, style, data }) => {
  const item = data.items[index];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getPaymentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'PIX RECEBIDO': 'bg-green-900 text-green-200',
      'PIX ENVIADO': 'bg-red-900 text-red-200',
      'TED': 'bg-blue-900 text-blue-200',
      'DOC': 'bg-purple-900 text-purple-200',
      'CARTÃO': 'bg-indigo-900 text-indigo-200',
      'DINHEIRO': 'bg-yellow-900 text-yellow-200',
      'BOLETO': 'bg-orange-900 text-orange-200',
      'MANUAL': 'bg-pink-900 text-pink-200',
    };

    const colorClass = colors[type] || 'bg-gray-700 text-gray-300';

    return (
      <span className={`px-2 py-1 text-xs rounded ${colorClass}`}>
        {type}
      </span>
    );
  };

  const handleRemove = useCallback(() => {
    data.onRemoveItem(item.conferredId);
  }, [data.onRemoveItem, item.conferredId]);

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

      {/* Conferred Time */}
      <div className="col-span-2 text-gray-300 flex items-center">
        <Clock className="h-4 w-4 mr-1 text-gray-500" />
        <span className="text-xs">
          {formatDateTime(item.conferredAt)}
        </span>
      </div>

      {/* Payment Type */}
      <div className="col-span-2 flex items-center">
        {getPaymentTypeBadge(item.paymentType)}
      </div>

      {/* CPF */}
      <div className="col-span-2 text-gray-300 font-mono flex items-center">
        {item.cpf ?
          `${item.cpf.slice(0, 3)}.${item.cpf.slice(3, 6)}.${item.cpf.slice(6, 9)}-${item.cpf.slice(9)}`
          : '-'
        }
      </div>

      {/* Value */}
      <div className="col-span-2 text-right font-semibold flex items-center justify-end">
        <span className={item.value >= 0 ? 'text-green-400' : 'text-red-400'}>
          {formatCurrency(item.value)}
        </span>
      </div>

      {/* Description */}
      <div className="col-span-2 text-gray-300 flex items-center">
        <span className="truncate" title={item.originalHistory}>
          {item.originalHistory || item.description || '-'}
        </span>
      </div>

      {/* Actions */}
      <div className="col-span-1 flex items-center justify-center">
        <button
          onClick={handleRemove}
          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
          title="Remover da conferência de caixa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

CashTableRow.displayName = 'CashTableRow';

export const VirtualizedCashTable: React.FC<VirtualizedCashTableProps> = ({
  conferredItems,
  onRemoveItem,
  className = ''
}) => {
  // Filters state
  const [filters, setFilters] = usePersistentState<TableFilters>('cash_table_filters', {
    dateFilter: '',
    typeFilter: 'all',
    statusFilter: 'all',
    searchText: '',
  });

  // Use memoized selectors
  const { filteredData, stats, isEmpty, hasFilters } = useCashTableSelectors(
    conferredItems,
    filters
  );

  // Memoized filter options
  const filterOptions = useMemo(() => {
    const paymentTypes = [...new Set(conferredItems.map(item => item.paymentType))].sort();
    return { paymentTypes };
  }, [conferredItems]);

  // Memoized data for the virtual list
  const listData = useMemo(() => ({
    items: filteredData,
    onRemoveItem
  }), [filteredData, onRemoveItem]);

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
    <div className={`bg-gray-800 border border-gray-700 w-full ${className}`}>
      {/* Header with stats and filters */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-200">
            Conferência de Caixa
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>Total: {stats.totalItems}</span>
            <span>Filtrados: {stats.filteredCount}</span>
            <span>Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.filteredValue)}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar por descrição, CPF, valor..."
            value={filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Payment Type Filter */}
          <select
            value={filters.typeFilter}
            onChange={(e) => handleFilterChange('typeFilter', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os tipos</option>
            {filterOptions.paymentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-750 border-b border-gray-700 text-sm font-semibold text-gray-300">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Conferido em</div>
        <div className="col-span-2">Tipo</div>
        <div className="col-span-2">CPF</div>
        <div className="col-span-2 text-right">Valor</div>
        <div className="col-span-2">Descrição</div>
        <div className="col-span-1 text-center">Ações</div>
      </div>

      {/* Virtualized Table Body */}
      {isEmpty ? (
        <div className="p-8 text-center text-gray-400">
          {hasFilters ? 'Nenhum resultado encontrado com os filtros aplicados' : 'Nenhum item conferido ainda'}
        </div>
      ) : (
        <List
          height={TABLE_HEIGHT}
          itemCount={filteredData.length}
          itemSize={ROW_HEIGHT}
          itemData={listData}
          className="custom-scrollbar"
        >
          {CashTableRow}
        </List>
      )}

      {/* Footer with additional stats */}
      {!isEmpty && (
        <div className="p-3 border-t border-gray-700 bg-gray-750">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <div>
              Média: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.averageValue)}
            </div>
            <div className="flex space-x-4">
              {Object.entries(stats.itemsByType).slice(0, 3).map(([type, count]) => (
                <span key={type}>
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};