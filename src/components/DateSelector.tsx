import React, { useState, useEffect } from 'react';
import { parseExcelFile } from '../utils/excelParser';
import { formatToDDMMYYYY, formatForDateInput, formatForDisplay, getTodayDDMMYYYY } from '../utils/dateFormatter';

interface DateSelectorProps {
  selectedFile: File | null;
  onDateSelected: (date: string, mode: 'automatic' | 'manual') => void;
  className?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  selectedFile,
  onDateSelected,
  className = ''
}) => {
  const [dateMode, setDateMode] = useState<'automatic' | 'manual'>('automatic');
  const [manualDate, setManualDate] = useState<string>(
    formatForDateInput(new Date())
  );
  const [automaticDate, setAutomaticDate] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // Detect date from file automatically
  useEffect(() => {
    if (selectedFile && dateMode === 'automatic') {
      detectDateFromFile();
    }
  }, [selectedFile, dateMode]);

  const detectDateFromFile = async () => {
    if (!selectedFile) return;

    setIsDetecting(true);
    setDetectionError(null);

    try {
      // Parse file to extract dates
      const result = await parseExcelFile(selectedFile);

      if (result.success && result.data.length > 0) {
        // Find the most common date or the first valid date
        const dates = result.data
          .map(item => item.date)
          .filter(date => date && date !== 'Invalid Date');

        if (dates.length > 0) {
          // Count occurrences of each date
          const dateCount = dates.reduce((acc, date) => {
            acc[date] = (acc[date] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Find the most common date
          const mostCommonDate = Object.entries(dateCount)
            .sort(([, a], [, b]) => b - a)[0][0];

          // Convert to DD-MM-YYYY format
          const formattedDate = formatToDDMMYYYY(mostCommonDate);

          setAutomaticDate(formattedDate);
          onDateSelected(formattedDate, 'automatic');
        } else {
          // No valid dates found, use today's date
          const today = getTodayDDMMYYYY();
          setAutomaticDate(today);
          setDetectionError('Nenhuma data válida encontrada no arquivo. Usando data atual.');
          onDateSelected(today, 'automatic');
        }
      } else {
        // Failed to parse file, use today's date
        const today = getTodayDDMMYYYY();
        setAutomaticDate(today);
        setDetectionError('Não foi possível detectar data do arquivo. Usando data atual.');
        onDateSelected(today, 'automatic');
      }
    } catch (error) {
      console.error('Error detecting date from file:', error);
      const today = getTodayDDMMYYYY();
      setAutomaticDate(today);
      setDetectionError('Erro ao detectar data. Usando data atual.');
      onDateSelected(today, 'automatic');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDateModeChange = (mode: 'automatic' | 'manual') => {
    setDateMode(mode);
    setDetectionError(null);

    if (mode === 'automatic' && automaticDate) {
      onDateSelected(automaticDate, 'automatic');
    } else if (mode === 'manual') {
      const formattedDate = formatToDDMMYYYY(manualDate);
      onDateSelected(formattedDate, 'manual');
    }
  };

  const handleManualDateChange = (date: string) => {
    setManualDate(date);
    if (dateMode === 'manual') {
      // Convert from ISO format to DD-MM-YYYY before sending
      const formattedDate = formatToDDMMYYYY(date);
      onDateSelected(formattedDate, 'manual');
    }
  };

  const getCurrentDate = () => {
    if (dateMode === 'automatic') {
      return automaticDate || getTodayDDMMYYYY();
    }
    // Convert from ISO format to DD-MM-YYYY
    return formatToDDMMYYYY(manualDate);
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-100 mb-3 flex items-center">
        <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">
          2
        </span>
        Selecionar Dia
      </h3>

      <div className="space-y-3">
        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="dateMode"
              value="automatic"
              checked={dateMode === 'automatic'}
              onChange={() => handleDateModeChange('automatic')}
              className="mr-2 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex-1">
              <span className="text-sm text-gray-300 group-hover:text-gray-100">
                Data Automática
              </span>
              {dateMode === 'automatic' && automaticDate && (
                <span className="ml-2 text-xs text-indigo-400">
                  ({formatForDisplay(automaticDate)})
                </span>
              )}
            </div>
          </label>

          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="dateMode"
              value="manual"
              checked={dateMode === 'manual'}
              onChange={() => handleDateModeChange('manual')}
              className="mr-2 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-300 group-hover:text-gray-100">
              Selecionar Manualmente
            </span>
          </label>
        </div>

        {/* Manual Date Input */}
        {dateMode === 'manual' && (
          <div className="mt-2">
            <label htmlFor="manual-date-input" className="sr-only">
              Data manual
            </label>
            <input
              id="manual-date-input"
              type="date"
              value={manualDate}
              onChange={(e) => handleManualDateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              aria-label="Selecionar data manualmente"
            />
          </div>
        )}

        {/* Status Messages */}
        {isDetecting && (
          <div className="p-2 bg-indigo-900/20 border border-indigo-600 rounded-md">
            <div className="flex items-center">
              <svg className="animate-spin h-4 w-4 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs text-indigo-400">Detectando data do arquivo...</span>
            </div>
          </div>
        )}

        {detectionError && (
          <div className="p-2 bg-yellow-900/20 border border-yellow-600 rounded-md">
            <p className="text-xs text-yellow-400">{detectionError}</p>
          </div>
        )}

        {/* Current Date Display */}
        <div className="bg-gray-900 rounded p-3 border border-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Data selecionada:</span>
            <div className="text-right">
              <span className="text-sm text-indigo-400 font-medium">
                {formatForDisplay(getCurrentDate())}
              </span>
              <span className="block text-xs text-gray-500 mt-1">
                Modo: {dateMode === 'automatic' ? 'Automático' : 'Manual'}
              </span>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="p-2 bg-gray-700 rounded-md">
          <p className="text-xs text-gray-400">
            {dateMode === 'automatic'
              ? 'A data será detectada automaticamente do arquivo carregado.'
              : 'Você está selecionando a data manualmente.'}
          </p>
        </div>
      </div>
    </div>
  );
};