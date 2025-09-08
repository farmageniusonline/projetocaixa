import React from 'react';
import { ValueMatch, formatCurrency } from '../utils/valueNormalizer';

interface ValueSelectionModalProps {
  isOpen: boolean;
  matches: ValueMatch[];
  searchValue: number;
  onSelect: (match: ValueMatch) => void;
  onClose: () => void;
}

export const ValueSelectionModal: React.FC<ValueSelectionModalProps> = ({
  isOpen,
  matches,
  searchValue,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  const formatCPF = (cpf: string) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                Múltiplas Correspondências Encontradas
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Valor pesquisado: <span className="text-indigo-400 font-mono">{formatCurrency(searchValue)}</span> 
                - Encontrados {matches.length} registros
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-md transition-colors"
              aria-label="Fechar modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-300 mb-4">
            Selecione qual registro deseja transferir para a Conferência de Caixa:
          </p>

          <div className="overflow-auto max-h-96">
            <div className="space-y-2">
              {matches.map((match, index) => (
                <button
                  key={match.id}
                  onClick={() => onSelect(match)}
                  className="w-full p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-indigo-500 rounded-lg transition-colors text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Data</p>
                      <p className="text-sm text-gray-100 font-medium">{match.date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Tipo de Pagamento</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        match.paymentType === 'PIX RECEBIDO' ? 'bg-green-900/50 text-green-300 border border-green-700' :
                        match.paymentType === 'PIX ENVIADO' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                        match.paymentType === 'TED' ? 'bg-blue-900/50 text-blue-300 border border-blue-700' :
                        match.paymentType === 'CARTÃO' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' :
                        'bg-gray-600 text-gray-300 border border-gray-500'
                      }`}>
                        {match.paymentType}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">CPF</p>
                      <p className="text-sm text-gray-100 font-mono">{formatCPF(match.cpf)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Valor</p>
                      <p className={`text-sm font-mono font-semibold ${
                        match.value >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(match.value)}
                      </p>
                    </div>
                  </div>
                  
                  {match.originalHistory && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Histórico Original</p>
                      <p className="text-xs text-gray-300 truncate" title={match.originalHistory}>
                        {match.originalHistory}
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-3 flex items-center justify-end">
                    <div className="flex items-center text-indigo-400">
                      <span className="text-xs">Clique para selecionar</span>
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 px-6 py-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};