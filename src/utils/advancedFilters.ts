import { ParsedRow } from './excelParser';
import { formatForDisplay } from './dateFormatter';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ValueRange {
  min: number;
  max: number;
}

export interface AdvancedFilterOptions {
  dateRange?: DateRange;
  paymentTypes?: string[];
  valueRange?: ValueRange;
  cpfFilter?: string;
  searchText?: string;
  validationStatus?: ('valid' | 'warning' | 'error')[];
  sortBy?: 'date' | 'value' | 'paymentType' | 'cpf';
  sortOrder?: 'asc' | 'desc';
  onlyTransferred?: boolean;
  onlyNotTransferred?: boolean;
}

export interface FilterResult {
  filteredData: ParsedRow[];
  statistics: {
    totalRecords: number;
    filteredRecords: number;
    totalValue: number;
    filteredValue: number;
    paymentTypeBreakdown: Record<string, { count: number; value: number }>;
    dateRangeInfo: {
      earliestDate: string;
      latestDate: string;
    };
  };
}

/**
 * Parse date string in DD/MM/YYYY or DD-MM-YYYY format
 */
function parseDate(dateStr: string): Date | null {
  try {
    if (dateStr === 'Data inválida') return null;

    let parts: number[];
    if (dateStr.includes('/')) {
      parts = dateStr.split('/').map(Number);
    } else if (dateStr.includes('-')) {
      parts = dateStr.split('-').map(Number);
    } else {
      return null;
    }

    const [day, month, year] = parts;
    if (!day || !month || !year) return null;

    return new Date(year, month - 1, day);
  } catch {
    return null;
  }
}

/**
 * Check if date falls within range
 */
function isDateInRange(dateStr: string, range: DateRange): boolean {
  const date = parseDate(dateStr);
  if (!date) return false;

  return date >= range.start && date <= range.end;
}

/**
 * Check if value falls within range
 */
function isValueInRange(value: number, range: ValueRange): boolean {
  return value >= range.min && value <= range.max;
}

/**
 * Check if text contains search term (case insensitive)
 */
function matchesSearchText(record: ParsedRow, searchText: string): boolean {
  const search = searchText.toLowerCase();
  return (
    record.originalHistory.toLowerCase().includes(search) ||
    record.cpf.includes(searchText.replace(/\D/g, '')) ||
    record.paymentType.toLowerCase().includes(search) ||
    record.value.toString().includes(searchText) ||
    record.date.includes(searchText)
  );
}

/**
 * Sort records based on criteria
 */
function sortRecords(records: ParsedRow[], sortBy: string, sortOrder: 'asc' | 'desc'): ParsedRow[] {
  const sorted = [...records];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (dateA && dateB) {
          comparison = dateA.getTime() - dateB.getTime();
        }
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

      default:
        return 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Calculate statistics for filtered data
 */
function calculateStatistics(originalData: ParsedRow[], filteredData: ParsedRow[]): FilterResult['statistics'] {
  const totalValue = originalData.reduce((sum, record) => sum + record.value, 0);
  const filteredValue = filteredData.reduce((sum, record) => sum + record.value, 0);

  // Payment type breakdown
  const paymentTypeBreakdown: Record<string, { count: number; value: number }> = {};
  filteredData.forEach(record => {
    if (!paymentTypeBreakdown[record.paymentType]) {
      paymentTypeBreakdown[record.paymentType] = { count: 0, value: 0 };
    }
    paymentTypeBreakdown[record.paymentType].count++;
    paymentTypeBreakdown[record.paymentType].value += record.value;
  });

  // Date range info
  const dates = filteredData.map(r => parseDate(r.date)).filter(Boolean) as Date[];
  const earliestDate = dates.length > 0
    ? Math.min(...dates.map(d => d.getTime()))
    : Date.now();
  const latestDate = dates.length > 0
    ? Math.max(...dates.map(d => d.getTime()))
    : Date.now();

  return {
    totalRecords: originalData.length,
    filteredRecords: filteredData.length,
    totalValue,
    filteredValue,
    paymentTypeBreakdown,
    dateRangeInfo: {
      earliestDate: formatForDisplay(new Date(earliestDate)),
      latestDate: formatForDisplay(new Date(latestDate))
    }
  };
}

/**
 * Apply advanced filters to data
 */
export function applyAdvancedFilters(
  data: ParsedRow[],
  options: AdvancedFilterOptions,
  transferredIds?: Set<string>
): FilterResult {
  let filteredData = [...data];

  // Date range filter
  if (options.dateRange) {
    filteredData = filteredData.filter(record =>
      isDateInRange(record.date, options.dateRange!)
    );
  }

  // Payment types filter
  if (options.paymentTypes && options.paymentTypes.length > 0) {
    filteredData = filteredData.filter(record =>
      options.paymentTypes!.includes(record.paymentType)
    );
  }

  // Value range filter
  if (options.valueRange) {
    filteredData = filteredData.filter(record =>
      isValueInRange(record.value, options.valueRange!)
    );
  }

  // CPF filter
  if (options.cpfFilter) {
    const cleanCpf = options.cpfFilter.replace(/\D/g, '');
    filteredData = filteredData.filter(record =>
      record.cpf.includes(cleanCpf)
    );
  }

  // Search text filter
  if (options.searchText && options.searchText.trim()) {
    filteredData = filteredData.filter(record =>
      matchesSearchText(record, options.searchText!)
    );
  }

  // Validation status filter
  if (options.validationStatus && options.validationStatus.length > 0) {
    filteredData = filteredData.filter(record =>
      options.validationStatus!.includes(record.validationStatus || 'valid')
    );
  }

  // Transfer status filters
  if (transferredIds) {
    if (options.onlyTransferred) {
      filteredData = filteredData.filter(record =>
        transferredIds.has((record as any).id)
      );
    } else if (options.onlyNotTransferred) {
      filteredData = filteredData.filter(record =>
        !transferredIds.has((record as any).id)
      );
    }
  }

  // Sort data
  if (options.sortBy) {
    filteredData = sortRecords(filteredData, options.sortBy, options.sortOrder || 'asc');
  }

  const statistics = calculateStatistics(data, filteredData);

  return {
    filteredData,
    statistics
  };
}

/**
 * Create preset filter configurations
 */
export const filterPresets = {
  today: (): AdvancedFilterOptions => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      dateRange: { start: today, end: tomorrow },
      sortBy: 'date',
      sortOrder: 'desc'
    };
  },

  thisWeek: (): AdvancedFilterOptions => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return {
      dateRange: { start: weekStart, end: weekEnd },
      sortBy: 'date',
      sortOrder: 'desc'
    };
  },

  thisMonth: (): AdvancedFilterOptions => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    return {
      dateRange: { start: monthStart, end: monthEnd },
      sortBy: 'date',
      sortOrder: 'desc'
    };
  },

  pixOnly: (): AdvancedFilterOptions => ({
    paymentTypes: ['PIX RECEBIDO', 'PIX ENVIADO'],
    sortBy: 'value',
    sortOrder: 'desc'
  }),

  highValues: (): AdvancedFilterOptions => ({
    valueRange: { min: 1000, max: Infinity },
    sortBy: 'value',
    sortOrder: 'desc'
  }),

  lowValues: (): AdvancedFilterOptions => ({
    valueRange: { min: 0, max: 100 },
    sortBy: 'value',
    sortOrder: 'asc'
  }),

  withErrors: (): AdvancedFilterOptions => ({
    validationStatus: ['error', 'warning'],
    sortBy: 'date',
    sortOrder: 'desc'
  }),

  notTransferred: (): AdvancedFilterOptions => ({
    onlyNotTransferred: true,
    sortBy: 'value',
    sortOrder: 'desc'
  })
};

/**
 * Get available payment types from data
 */
export function getAvailablePaymentTypes(data: ParsedRow[]): string[] {
  const types = new Set<string>();
  data.forEach(record => {
    if (record.paymentType) {
      types.add(record.paymentType);
    }
  });
  return Array.from(types).sort();
}

/**
 * Get value statistics from data
 */
export function getValueStatistics(data: ParsedRow[]): {
  min: number;
  max: number;
  average: number;
  median: number;
  total: number;
} {
  if (data.length === 0) {
    return { min: 0, max: 0, average: 0, median: 0, total: 0 };
  }

  const values = data.map(record => record.value).sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = total / values.length;
  const median = values.length % 2 === 0
    ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
    : values[Math.floor(values.length / 2)];

  return {
    min: values[0],
    max: values[values.length - 1],
    average,
    median,
    total
  };
}

/**
 * Export filtered data to CSV format
 */
export function exportToCSV(data: ParsedRow[], filename: string = 'filtered-data.csv'): void {
  const headers = ['Data', 'Tipo de Pagamento', 'CPF', 'Valor', 'Histórico Original', 'Status'];
  const csvContent = [
    headers.join(','),
    ...data.map(record => [
      record.date,
      record.paymentType,
      record.cpf,
      record.value.toFixed(2).replace('.', ','),
      `"${record.originalHistory.replace(/"/g, '""')}"`,
      record.validationStatus || 'valid'
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}