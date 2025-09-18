import React, { useState } from 'react';
import { ExportService, ExportData } from '../services/exportService';
import { formatToDDMMYYYY } from '../utils/dateFormatter';
import { performanceLogger } from '../utils/performanceLogger';
import toast from 'react-hot-toast';

interface ExportButtonsProps {
  data: ExportData;
  prefix: string;
  date?: string;
  className?: string;
  disabled?: boolean;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  data,
  prefix,
  date,
  className = '',
  disabled = false
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (disabled) return;

    // Check if there's data to export
    const hasData = Object.values(data).some(dataArray =>
      Array.isArray(dataArray) && dataArray.length > 0
    );

    if (!hasData) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    // Count total records
    const totalRecords = Object.values(data).reduce((total, dataArray) => {
      return total + (Array.isArray(dataArray) ? dataArray.length : 0);
    }, 0);

    setIsExporting(true);
    try {
      await performanceLogger.measureAsync('data_export', async () => {
        const filename = ExportService.generateFilename(prefix, format, date);

        if (format === 'csv') {
          ExportService.exportToCSV(data, filename);
        } else {
          ExportService.exportToXLSX(data, filename);
        }
      }, {
        format,
        totalRecords,
        prefix
      });

      toast.success(`Dados exportados! ${totalRecords} registros em formato ${format.toUpperCase()}.`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar dados');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`flex space-x-2 ${className}`}>
      <button
        onClick={() => handleExport('csv')}
        disabled={disabled || isExporting}
        className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        title="Exportar para CSV"
      >
        {isExporting ? (
          <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        )}
        CSV
      </button>

      <button
        onClick={() => handleExport('xlsx')}
        disabled={disabled || isExporting}
        className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        title="Exportar para Excel"
      >
        {isExporting ? (
          <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        )}
        XLSX
      </button>
    </div>
  );
};