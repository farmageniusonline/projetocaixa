import React, { useState, useMemo } from 'react';
import { ParsedRow } from '../utils/excelParser';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatForDisplay } from '../utils/dateFormatter';

interface DataTableProps {
  data: ParsedRow[];
  stats: {
    totalRows: number;
    validRows: number;
    rowsWithWarnings: number;
    rowsWithErrors: number;
    totalValue: number;
  };
  transferredIds?: Set<string>;
}

type SortField = 'date' | 'value' | 'paymentType' | 'cpf';
type SortDirection = 'asc' | 'desc';

export const DataTable: React.FC<DataTableProps> = ({ data, stats, transferredIds }) => {
  // Use persistent state for table settings
  const [sortField, setSortField] = usePersistentState<SortField>('datatable_sort_field', 'date');
  const [sortDirection, setSortDirection] = usePersistentState<SortDirection>('datatable_sort_direction', 'desc');
  const [filterPaymentType, setFilterPaymentType] = usePersistentState('datatable_filter_payment_type', 'all');
  const [filterCPF, setFilterCPF] = usePersistentState('datatable_filter_cpf', '');
  const [currentPage, setCurrentPage] = usePersistentState('datatable_current_page', 1);
  const itemsPerPage = 20;

  // Get unique payment types for filter
  const paymentTypes = useMemo(() => {
    const types = new Set(data.map(row => row.paymentType));
    return Array.from(types).sort();
  }, [data]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Remove transferred items
    if (transferredIds && transferredIds.size > 0) {
      filtered = filtered.filter((row, index) => {
        const itemId = `row-${index}-${row.date}-${row.value}`;
        return !transferredIds.has(itemId);
      });
    }

    // Apply filters
    if (filterPaymentType !== 'all') {
      filtered = filtered.filter(row => row.paymentType === filterPaymentType);
    }

    if (filterCPF) {
      filtered = filtered.filter(row => row.cpf.includes(filterCPF));
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date': {
            const dateA = a.date.split('/').reverse().join('');
          const dateB = b.date.split('/').reverse().join('');
          comparison = dateA.localeCompare(dateB);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
        case 'paymentType':
          comparison = a.paymentType.localeCompare(b.paymentType);
          break;
        case 'cpf':
          comparison = a.cpf.localeCompare(b.cpf);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, transferredIds, filterPaymentType, filterCPF, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = processedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Stats Bar */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-gray-400">Total de Linhas</p>
            <p className="text-lg font-semibold text-gray-100">{stats.totalRows}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Linhas Válidas</p>
            <p className="text-lg font-semibold text-green-400">{stats.validRows}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Com Avisos</p>
            <p className="text-lg font-semibold text-yellow-400">{stats.rowsWithWarnings}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Com Erros</p>
            <p className="text-lg font-semibold text-red-400">{stats.rowsWithErrors}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Valor Total</p>
            <p className="text-lg font-semibold text-gray-100">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1">Filtrar por Tipo de Pagamento</label>
            <select
              value={filterPaymentType}
              onChange={(e) => {
                setFilterPaymentType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Todos</option>
              {paymentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1">Filtrar por CPF</label>
            <input
              type="text"
              value={filterCPF}
              onChange={(e) => {
                setFilterCPF(e.target.value.replace(/\D/g, ''));
                setCurrentPage(1);
              }}
              placeholder="Digite o CPF (somente números)"
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterPaymentType('all');
                setFilterCPF('');
                setCurrentPage(1);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-900 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-300 hover:text-gray-100"
                >
                  <span>Data</span>
                  {sortField === 'date' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('paymentType')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-300 hover:text-gray-100"
                >
                  <span>Tipo de Pagamento</span>
                  {sortField === 'paymentType' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('cpf')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-300 hover:text-gray-100"
                >
                  <span>CPF</span>
                  {sortField === 'cpf' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('value')}
                  className="flex items-center justify-end space-x-1 text-xs font-medium text-gray-300 hover:text-gray-100 ml-auto"
                >
                  <span>Valor (R$)</span>
                  {sortField === 'value' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">
                Histórico Original
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{formatForDisplay(row.date)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    row.paymentType === 'PIX RECEBIDO' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                    row.paymentType === 'PIX ENVIADO' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                    row.paymentType === 'TED' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
                    row.paymentType === 'CARTÃO' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' :
                    'bg-gray-700 text-gray-300 border border-gray-600'
                  }`}>
                    {row.paymentType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-mono">{formatCPF(row.cpf)}</td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${
                  row.value >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrency(row.value)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate" title={row.originalHistory}>
                  {row.originalHistory}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.validationStatus === 'valid' && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-900/50 text-green-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  {row.validationStatus === 'warning' && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-900/50 text-yellow-400" title={row.validationMessage}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </span>
                  )}
                  {row.validationStatus === 'error' && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-900/50 text-red-400" title={row.validationMessage}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-900 border-t border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, processedData.length)} de {processedData.length} registros
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = currentPage <= 3 ? i + 1 : 
                  currentPage >= totalPages - 2 ? totalPages - 4 + i : 
                  currentPage - 2 + i;
                
                if (pageNum < 1 || pageNum > totalPages) return null;
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      currentPage === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-300 bg-gray-800 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};