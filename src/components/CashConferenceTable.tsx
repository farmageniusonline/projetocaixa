import React, { useState } from 'react';
import { ValueMatch, formatCurrency } from '../utils/valueNormalizer';
import { formatForDisplay } from '../utils/dateFormatter';

interface ConferredItem extends ValueMatch {
  conferredAt: Date;
  conferredId: string;
}

interface CashConferenceTableProps {
  conferredItems: ConferredItem[];
  onRemoveItem: (conferredId: string) => void;
}

export const CashConferenceTable: React.FC<CashConferenceTableProps> = ({
  conferredItems,
  onRemoveItem,
}) => {
  const [sortField, setSortField] = useState<'date' | 'value' | 'conferredAt'>('conferredAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'date' | 'value' | 'conferredAt') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedItems = [...conferredItems].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'date':
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        comparison = dateA.localeCompare(dateB);
        break;
      case 'value':
        comparison = a.value - b.value;
        break;
      case 'conferredAt':
        comparison = a.conferredAt.getTime() - b.conferredAt.getTime();
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatCPF = (cpf: string) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatConferredTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const totalConferred = conferredItems.reduce((sum, item) => sum + item.value, 0);

  if (conferredItems.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
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
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-300">
              Nenhum valor conferido ainda
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Use o campo "Conferir Valor" na sidebar para transferir registros para cá.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Summary Bar */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">Total de Itens</p>
            <p className="text-lg font-semibold text-gray-100">{conferredItems.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Valor Total Conferido</p>
            <p className="text-lg font-semibold text-green-400">{formatCurrency(totalConferred)}</p>
          </div>
          <div className="hidden md:block">
            <p className="text-xs text-gray-400">Última Conferência</p>
            <p className="text-sm text-gray-300">
              {conferredItems.length > 0 && formatConferredTime(
                [...conferredItems].sort((a, b) => b.conferredAt.getTime() - a.conferredAt.getTime())[0].conferredAt
              )}
            </p>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">
                Tipo de Pagamento
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300">
                CPF
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
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('conferredAt')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-300 hover:text-gray-100"
                >
                  <span>Conferido em</span>
                  {sortField === 'conferredAt' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedItems.map((item) => (
              <tr key={item.conferredId} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{formatForDisplay(item.date)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    item.paymentType === 'PIX RECEBIDO' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                    item.paymentType === 'PIX ENVIADO' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                    item.paymentType === 'TED' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
                    item.paymentType === 'CARTÃO' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' :
                    'bg-gray-700 text-gray-300 border border-gray-600'
                  }`}>
                    {item.paymentType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 font-mono">{formatCPF(item.cpf)}</td>
                <td className={`px-4 py-3 text-sm text-right font-mono ${
                  item.value >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrency(item.value)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {formatConferredTime(item.conferredAt)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onRemoveItem(item.conferredId)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                    title="Remover da conferência"
                    aria-label={`Remover item de ${formatCurrency(item.value)} da conferência`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};