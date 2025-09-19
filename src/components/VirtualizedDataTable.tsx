import React, { useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ValueMatch } from '../utils/valueNormalizer';
import { useBankingTableSelectors, TableFilters } from '../hooks/useTableSelectors';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatForDisplay } from '../utils/dateFormatter';

interface VirtualizedDataTableProps {
  parseResult: { data: ValueMatch[] } | null;
  transferredIds: Set<string>;
  className?: string;
}

// Memoized row component to prevent unnecessary re-renders
const TableRow = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    items: ValueMatch[];
    transferredIds: Set<string>;
  };
}>(({ index, style, data }) => {
  const item = data.items[index];
  const isTransferred = data.transferredIds.has(item.id);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <span className="px-2 py-1 text-xs bg-green-900 text-green-200 rounded">Válido</span>;
      case 'warning':
        return <span className="px-2 py-1 text-xs bg-yellow-900 text-yellow-200 rounded">Aviso</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs bg-red-900 text-red-200 rounded">Erro</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Desconhecido</span>;
    }
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
    };

    const colorClass = colors[type] || 'bg-gray-700 text-gray-300';

    return (
      <span className={`px-2 py-1 text-xs rounded ${colorClass}`}>
        {type}
      </span>
    );
  };

  return (
    <div
      style={style}
      className={`grid grid-cols-12 gap-2 px-4 py-2 border-b border-gray-700 text-sm ${
        isTransferred
          ? 'bg-gray-800 opacity-50'
          : index % 2 === 0
          ? 'bg-gray-900'
          : 'bg-gray-850'
      }`}
    >
      {/* Index */}
      <div className="col-span-1 text-gray-400 font-mono">
        {index + 1}
      </div>

      {/* Date */}
      <div className="col-span-2 text-gray-300">
        {item.date ? formatForDisplay(item.date) : '-'}
      </div>

      {/* Payment Type */}
      <div className="col-span-2">
        {getPaymentTypeBadge(item.paymentType)}
      </div>

      {/* CPF */}
      <div className="col-span-2 text-gray-300 font-mono">
        {item.cpf ?
          `${item.cpf.slice(0, 3)}.${item.cpf.slice(3, 6)}.${item.cpf.slice(6, 9)}-${item.cpf.slice(9)}`
          : '-'
        }
      </div>

      {/* Value */}
      <div className="col-span-2 text-right font-semibold">
        <span className={item.value >= 0 ? 'text-green-400' : 'text-red-400'}>
          {formatCurrency(item.value)}
        </span>
      </div>

      {/* Status */}
      <div className="col-span-2">
        {getStatusBadge(item.validationStatus || 'unknown')}
      </div>

      {/* Actions/Status */}
      <div className="col-span-1 text-center">
        {isTransferred ? (
          <span className="text-xs text-green-400">✓ Transferido</span>
        ) : (
          <span className="text-xs text-gray-400">Disponível</span>
        )}
      </div>
    </div>
  );
});

TableRow.displayName = 'TableRow';

export const VirtualizedDataTable: React.FC<VirtualizedDataTableProps> = ({
  parseResult,
  transferredIds,
  className = ''
}) => {
  // Filters state
  const [filters, setFilters] = usePersistentState<TableFilters>('banking_table_filters', {
    dateFilter: '',
    typeFilter: 'all',
    statusFilter: 'all',
    searchText: '',
  });

  // Use memoized selectors
  const { filteredData, stats, isEmpty, hasFilters } = useBankingTableSelectors(
    parseResult,
    transferredIds,
    filters
  );

  // Memoized filter options
  const filterOptions = useMemo(() => {
    if (!parseResult?.data) return { paymentTypes: [], statuses: [] };

    const paymentTypes = [...new Set(parseResult.data.map(item => item.paymentType))].sort();
    const statuses = [...new Set(parseResult.data.map(item => item.validationStatus || 'unknown'))].sort();

    return { paymentTypes, statuses };
  }, [parseResult?.data]);

  // Memoized data for the virtual list
  const listData = useMemo(() => ({
    items: filteredData,
    transferredIds
  }), [filteredData, transferredIds]);

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

  if (!parseResult?.data) {
    return (
      <div className={`bg-gray-800 border border-gray-700 rounded-lg ${className}`}>
        <div className="p-8 text-center text-gray-400">
          Carregue uma planilha para visualizar os dados bancários
        </div>
      </div>
    );
  }

  const ROW_HEIGHT = 60;
  const TABLE_HEIGHT = Math.min(600, Math.max(300, filteredData.length * ROW_HEIGHT + 50));

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg ${className}`}>
      {/* Header with stats and filters */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-200">
            Dados Bancários
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>Total: {stats.totalItems}</span>
            <span>Filtrados: {stats.filteredCount}</span>
            <span>Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.filteredValue)}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar..."
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

          {/* Status Filter */}
          <select
            value={filters.statusFilter}
            onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os status</option>
            {filterOptions.statuses.map(status => (
              <option key={status} value={status}>
                {status === 'valid' ? 'Válido' : status === 'warning' ? 'Aviso' : status === 'error' ? 'Erro' : status}
              </option>
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
        <div className="col-span-2">Data</div>
        <div className="col-span-2">Tipo</div>
        <div className="col-span-2">CPF</div>
        <div className="col-span-2 text-right">Valor</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-center">Situação</div>
      </div>

      {/* Virtualized Table Body */}
      {isEmpty ? (
        <div className="p-8 text-center text-gray-400">
          {hasFilters ? 'Nenhum resultado encontrado com os filtros aplicados' : 'Nenhum dado disponível'}
        </div>
      ) : (
        <List
          height={TABLE_HEIGHT}
          itemCount={filteredData.length}
          itemSize={ROW_HEIGHT}
          itemData={listData}
          className="custom-scrollbar"
        >
          {TableRow}
        </List>
      )}

      {/* Footer with additional stats */}
      {!isEmpty && (
        <div className="p-3 border-t border-gray-700 bg-gray-750">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <div>
              Média: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.averageValue)}
            </div>
            <div>
              {Object.entries(stats.itemsByType).slice(0, 3).map(([type, count]) => (
                <span key={type} className="mr-4">
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