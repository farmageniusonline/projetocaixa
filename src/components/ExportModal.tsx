import React, { useState } from 'react';
import { ParsedRow } from '../utils/excelParser';
import { ExportOptions, exportData, exportFormats } from '../utils/reportExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ParsedRow[];
  filteredData?: ParsedRow[];
  title?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  data,
  filteredData,
  title = 'Exportar Relatório'
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    includeStatistics: true,
    includeCharts: false,
    groupBy: 'none'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [customFileName, setCustomFileName] = useState('');

  const dataToExport = filteredData || data;
  const hasFilters = filteredData && filteredData.length !== data.length;

  const handleExport = async () => {
    if (dataToExport.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    setIsExporting(true);

    try {
      const exportOptions: ExportOptions = {
        ...options,
        customFileName: customFileName.trim() || undefined
      };

      await exportData(dataToExport, exportOptions);
      onClose();
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert(`Erro ao exportar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const updateOptions = (newOptions: Partial<ExportOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  const selectedFormat = exportFormats.find(f => f.value === options.format);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Data Summary */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Resumo dos Dados</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total de registros:</span>
              <span className="text-gray-100 ml-2 font-medium">{data.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Registros a exportar:</span>
              <span className="text-gray-100 ml-2 font-medium">{dataToExport.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Valor total:</span>
              <span className="text-green-400 ml-2 font-medium">
                {dataToExport.reduce((sum, record) => sum + record.value, 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                })}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Filtros aplicados:</span>
              <span className={`ml-2 font-medium ${hasFilters ? 'text-yellow-400' : 'text-gray-400'}`}>
                {hasFilters ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </div>

        {/* Export Format Selection */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Formato de Exportação</h4>
          <div className="grid grid-cols-2 gap-3">
            {exportFormats.map(format => (
              <label
                key={format.value}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  options.format === format.value
                    ? 'border-indigo-500 bg-indigo-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={format.value}
                  checked={options.format === format.value}
                  onChange={(e) => updateOptions({ format: e.target.value as any })}
                  className="sr-only"
                />
                <div className="flex items-start flex-1">
                  <span className="text-2xl mr-3">{format.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-100">{format.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{format.description}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom File Name */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Nome do Arquivo (Opcional)</h4>
          <div className="flex">
            <input
              type="text"
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              placeholder={`relatorio-${new Date().toISOString().split('T')[0]}`}
              className="flex-1 px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-l focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="px-3 py-2 text-sm text-gray-400 bg-gray-600 border border-l-0 border-gray-600 rounded-r">
              {selectedFormat?.fileExtension}
            </span>
          </div>
        </div>

        {/* Export Options */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Opções de Exportação</h4>

          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeStatistics || false}
                onChange={(e) => updateOptions({ includeStatistics: e.target.checked })}
                className="mr-3 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <div>
                <span className="text-sm text-gray-300">Incluir Estatísticas</span>
                <div className="text-xs text-gray-400">Adiciona resumos, totais e breakdown por tipo de pagamento</div>
              </div>
            </label>

            {/* Group By Option */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Agrupar por</label>
              <select
                value={options.groupBy || 'none'}
                onChange={(e) => updateOptions({ groupBy: e.target.value as any })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="none">Não agrupar</option>
                <option value="date">Data</option>
                <option value="paymentType">Tipo de Pagamento</option>
              </select>
              <div className="text-xs text-gray-400 mt-1">
                Separa os dados em grupos distintos (Excel: abas separadas, CSV: seções)
              </div>
            </div>
          </div>
        </div>

        {/* Format-specific Options */}
        {options.format === 'pdf' && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="text-sm text-yellow-400 font-medium">Limitação do PDF</div>
                <div className="text-xs text-yellow-300 mt-1">
                  Para manter o tamanho do arquivo, apenas os primeiros 100 registros por grupo serão incluídos no PDF.
                  Para relatórios completos, use Excel ou CSV.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || dataToExport.length === 0}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exportando...
              </>
            ) : (
              `Exportar ${selectedFormat?.label.split(' ')[0]}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};