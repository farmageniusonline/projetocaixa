import React, { useState, useEffect } from 'react';
import { AdvancedFilterOptions, filterPresets, getAvailablePaymentTypes, getValueStatistics } from '../utils/advancedFilters';
import { ParsedRow } from '../utils/excelParser';
import { formatForDateInput } from '../utils/dateFormatter';

interface AdvancedFiltersPanelProps {
  data: ParsedRow[];
  onFiltersChange: (filters: AdvancedFilterOptions) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const AdvancedFiltersPanel: React.FC<AdvancedFiltersPanelProps> = ({
  data,
  onFiltersChange,
  isOpen,
  onToggle
}) => {
  const [filters, setFilters] = useState<AdvancedFilterOptions>({});
  const [availablePaymentTypes, setAvailablePaymentTypes] = useState<string[]>([]);
  const [valueStats, setValueStats] = useState({ min: 0, max: 0, average: 0, median: 0, total: 0 });

  useEffect(() => {
    if (data.length > 0) {
      setAvailablePaymentTypes(getAvailablePaymentTypes(data));
      setValueStats(getValueStatistics(data));
    }
  }, [data]);

  const handleFilterChange = (newFilters: Partial<AdvancedFilterOptions>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const applyPreset = (presetName: keyof typeof filterPresets) => {
    const presetFilters = filterPresets[presetName]();
    setFilters(presetFilters);
    onFiltersChange(presetFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFiltersChange({});
  };


  return (
    <div className={`fixed right-0 top-16 h-full bg-gray-800 border-l border-gray-700 transition-transform duration-300 z-40 ${
      isOpen ? 'transform translate-x-0' : 'transform translate-x-full'
    }`} style={{ width: '400px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-gray-100">Filtros Avançados</h3>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 overflow-y-auto h-full pb-16">
        {/* Quick Presets */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Filtros Rápidos</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyPreset('today')}
              className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => applyPreset('thisWeek')}
              className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Esta Semana
            </button>
            <button
              onClick={() => applyPreset('thisMonth')}
              className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Este Mês
            </button>
            <button
              onClick={() => applyPreset('pixOnly')}
              className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Apenas PIX
            </button>
            <button
              onClick={() => applyPreset('highValues')}
              className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Valores Altos
            </button>
            <button
              onClick={() => applyPreset('withErrors')}
              className="px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Com Erros
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Período</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data Inicial</label>
              <input
                type="date"
                value={filters.dateRange?.start ? formatForDateInput(filters.dateRange.start) : ''}
                onChange={(e) => handleFilterChange({
                  dateRange: {
                    start: new Date(e.target.value),
                    end: filters.dateRange?.end || new Date()
                  }
                })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data Final</label>
              <input
                type="date"
                value={filters.dateRange?.end ? formatForDateInput(filters.dateRange.end) : ''}
                onChange={(e) => handleFilterChange({
                  dateRange: {
                    start: filters.dateRange?.start || new Date(),
                    end: new Date(e.target.value)
                  }
                })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Payment Types Filter */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Tipos de Pagamento</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {availablePaymentTypes.map(type => (
              <label key={type} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.paymentTypes?.includes(type) || false}
                  onChange={(e) => {
                    const currentTypes = filters.paymentTypes || [];
                    const newTypes = e.target.checked
                      ? [...currentTypes, type]
                      : currentTypes.filter(t => t !== type);
                    handleFilterChange({ paymentTypes: newTypes });
                  }}
                  className="mr-2 text-indigo-600 focus:ring-indigo-500 rounded"
                />
                <span className="text-xs text-gray-300">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Value Range Filter */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Faixa de Valores</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Valor Mínimo (R$ {valueStats.min.toFixed(2)})
              </label>
              <input
                type="number"
                step="0.01"
                min={valueStats.min}
                max={valueStats.max}
                value={filters.valueRange?.min || ''}
                onChange={(e) => handleFilterChange({
                  valueRange: {
                    min: parseFloat(e.target.value) || 0,
                    max: filters.valueRange?.max || valueStats.max
                  }
                })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Valor Máximo (R$ {valueStats.max.toFixed(2)})
              </label>
              <input
                type="number"
                step="0.01"
                min={valueStats.min}
                max={valueStats.max}
                value={filters.valueRange?.max || ''}
                onChange={(e) => handleFilterChange({
                  valueRange: {
                    min: filters.valueRange?.min || 0,
                    max: parseFloat(e.target.value) || valueStats.max
                  }
                })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={valueStats.max.toFixed(2)}
              />
            </div>
          </div>
        </div>

        {/* CPF Filter */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">CPF</h4>
          <input
            type="text"
            value={filters.cpfFilter || ''}
            onChange={(e) => handleFilterChange({ cpfFilter: e.target.value })}
            placeholder="000.000.000-00 ou parcial"
            className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Search Text Filter */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Busca no Histórico</h4>
          <input
            type="text"
            value={filters.searchText || ''}
            onChange={(e) => handleFilterChange({ searchText: e.target.value })}
            placeholder="Buscar em qualquer campo..."
            className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Validation Status Filter */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Status de Validação</h4>
          <div className="space-y-2">
            {[
              { value: 'valid', label: 'Válidos', color: 'text-green-400' },
              { value: 'warning', label: 'Com Avisos', color: 'text-yellow-400' },
              { value: 'error', label: 'Com Erros', color: 'text-red-400' }
            ].map(status => (
              <label key={status.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.validationStatus?.includes(status.value as any) || false}
                  onChange={(e) => {
                    const currentStatuses = filters.validationStatus || [];
                    const newStatuses = e.target.checked
                      ? [...currentStatuses, status.value as any]
                      : currentStatuses.filter(s => s !== status.value);
                    handleFilterChange({ validationStatus: newStatuses });
                  }}
                  className="mr-2 text-indigo-600 focus:ring-indigo-500 rounded"
                />
                <span className={`text-xs ${status.color}`}>{status.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Ordenação</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ordenar por</label>
              <select
                value={filters.sortBy || ''}
                onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Ordem original</option>
                <option value="date">Data</option>
                <option value="value">Valor</option>
                <option value="paymentType">Tipo de Pagamento</option>
                <option value="cpf">CPF</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ordem</label>
              <select
                value={filters.sortOrder || 'asc'}
                onChange={(e) => handleFilterChange({ sortOrder: e.target.value as any })}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="asc">Crescente</option>
                <option value="desc">Decrescente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transfer Status */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Status de Transferência</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.onlyTransferred || false}
                onChange={(e) => handleFilterChange({
                  onlyTransferred: e.target.checked,
                  onlyNotTransferred: e.target.checked ? false : filters.onlyNotTransferred
                })}
                className="mr-2 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <span className="text-xs text-green-400">Apenas Transferidos</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.onlyNotTransferred || false}
                onChange={(e) => handleFilterChange({
                  onlyNotTransferred: e.target.checked,
                  onlyTransferred: e.target.checked ? false : filters.onlyTransferred
                })}
                className="mr-2 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <span className="text-xs text-gray-400">Apenas Não Transferidos</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={clearFilters}
            className="w-full px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};