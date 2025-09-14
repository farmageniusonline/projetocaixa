export interface ValueMatchResult {
  hasMatches: boolean;
  matches: ValueMatch[];
  normalizedInput: number;
}

export interface ValueMatch {
  id: string;
  date: string;
  paymentType: string;
  cpf: string;
  value: number;
  originalHistory: string;
  rowIndex: number;
}

/**
 * Normalize a value string to a number for comparison
 * Handles various formats like "R$ 1.234,56", "1234.56", "1,234.56", etc.
 */
export function normalizeValue(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100) / 100; // Round to 2 decimal places
  }

  if (!input || typeof input !== 'string') {
    return 0;
  }

  // Remove currency symbols and spaces
  let cleanValue = input.trim()
    .replace(/[R$\s]/g, '')
    .replace(/[^\d,.-]/g, '');

  // Handle different decimal separators
  // Check if it's likely Brazilian format (1.234,56) vs US format (1,234.56)
  const commaIndex = cleanValue.lastIndexOf(',');
  const dotIndex = cleanValue.lastIndexOf('.');
  
  if (commaIndex > dotIndex) {
    // Brazilian format: 1.234,56 or just 1234,56
    cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
  } else if (dotIndex > commaIndex) {
    // US format: 1,234.56 or just 1234.56
    cleanValue = cleanValue.replace(/,/g, '');
  }
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}

/**
 * Search for exact value matches in the dataset
 */
export function searchValueMatches(
  searchValue: string | number, 
  dataset: any[]
): ValueMatchResult {
  const normalizedInput = normalizeValue(searchValue);
  
  if (normalizedInput === 0) {
    return {
      hasMatches: false,
      matches: [],
      normalizedInput: 0,
    };
  }

  const matches: ValueMatch[] = [];

  dataset.forEach((row, index) => {
    const normalizedRowValue = normalizeValue(row.value);
    
    if (normalizedRowValue === normalizedInput) {
      matches.push({
        id: `row-${index}-${row.date}-${row.value}`, // Unique ID based on row data
        date: row.date,
        paymentType: row.paymentType,
        cpf: row.cpf,
        value: row.value,
        originalHistory: row.originalHistory,
        rowIndex: index,
      });
    }
  });

  return {
    hasMatches: matches.length > 0,
    matches,
    normalizedInput,
  };
}

/**
 * Validate if a value string is in a valid format
 */
export function validateValueInput(input: string): {
  isValid: boolean;
  error?: string;
} {
  if (!input || input.trim() === '') {
    return {
      isValid: false,
      error: 'Digite um valor para conferir',
    };
  }

  const normalized = normalizeValue(input);
  
  if (normalized === 0) {
    return {
      isValid: false,
      error: 'Informe um valor válido (ex.: 123,45)',
    };
  }

  if (normalized < 0) {
    return {
      isValid: false,
      error: 'O valor deve ser positivo',
    };
  }

  return { isValid: true };
}

/**
 * Format a number as Brazilian currency (R$ 1.234,56)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Format a number for display in input fields (1.234,56)
 */
export function formatValueForInput(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}