import * as XLSX from 'xlsx';
import { formatToDDMMYYYY } from './dateFormatter';
import { logger } from './logger';

export interface ParsedRow {
  date: string;
  paymentType: string;
  cpf: string;
  value: number;
  originalHistory: string;
  validationStatus?: 'valid' | 'warning' | 'error';
  validationMessage?: string;
}

export interface ParseResult {
  success: boolean;
  data: ParsedRow[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    rowsWithWarnings: number;
    rowsWithErrors: number;
    totalValue: number;
  };
}

// Payment type patterns
const PAYMENT_TYPES = {
  'PIX RECEBIDO': /pix\s*recebid/i,
  'PIX ENVIADO': /pix\s*enviad/i,
  'TED': /\bted\b/i,
  'DOC': /\bdoc\b/i,
  'CARTÃO': /cart[aã]o/i,
  'DINHEIRO': /dinheiro/i,
  'BOLETO': /boleto/i,
  'TRANSFERÊNCIA': /transfer[eê]ncia/i,
  'DEPÓSITO': /dep[oó]sito/i,
  'SAQUE': /saque/i,
};

// Column name variations
const COLUMN_MAPPINGS = {
  date: ['data', 'date', 'data do lançamento', 'data do lancamento', 'dt', 'data mov', 'data movimento'],
  history: ['histórico', 'historico', 'descrição', 'descricao', 'histórico/descrição', 'historico/descricao', 'descrição/histórico', 'descricao/historico', 'desc'],
  value: ['valor', 'valor (r$)', 'valor r$', 'vlr', 'val'],
  credit: ['crédito', 'credito', 'entrada', 'receita'],
  debit: ['débito', 'debito', 'saída', 'saida', 'despesa'],
};

export async function parseExcelFile(file: File): Promise<ParseResult> {
  logger.debug('parseExcelFile: Starting to parse file:', file.name);
  try {
    logger.debug('parseExcelFile: Reading file as arrayBuffer...');
    const data = await file.arrayBuffer();
    logger.debug('parseExcelFile: ArrayBuffer size:', data.byteLength);

    logger.debug('parseExcelFile: Reading workbook with XLSX...');
    const workbook = XLSX.read(data, { type: 'array' });
    logger.debug('parseExcelFile: Workbook sheet names:', workbook.SheetNames);
    
    if (workbook.SheetNames.length === 0) {
      return {
        success: false,
        data: [],
        errors: ['Arquivo não contém planilhas'],
        warnings: [],
        stats: {
          totalRows: 0,
          validRows: 0,
          rowsWithWarnings: 0,
          rowsWithErrors: 0,
          totalValue: 0,
        },
      };
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length < 2) {
      return {
        success: false,
        data: [],
        errors: ['Arquivo não contém dados suficientes'],
        warnings: [],
        stats: {
          totalRows: 0,
          validRows: 0,
          rowsWithWarnings: 0,
          rowsWithErrors: 0,
          totalValue: 0,
        },
      };
    }

    // Find the real header row (may not be the first row)
    const headerInfo = findRealHeaderRow(jsonData);
    
    if (!headerInfo) {
      return {
        success: false,
        data: [],
        errors: ['Não foi possível encontrar cabeçalhos válidos. Verifique se o arquivo contém colunas: Data, Histórico e Valor'],
        warnings: [],
        stats: {
          totalRows: 0,
          validRows: 0,
          rowsWithWarnings: 0,
          rowsWithErrors: 0,
          totalValue: 0,
        },
      };
    }

    const { headerRowIndex, columnIndexes } = headerInfo;
    
    const missingColumns: string[] = [];
    if (columnIndexes.date === -1) missingColumns.push('Data');
    if (columnIndexes.history === -1) missingColumns.push('Histórico');
    if (columnIndexes.value === -1 && (columnIndexes.credit === -1 || columnIndexes.debit === -1)) {
      missingColumns.push('Valor (ou Crédito/Débito)');
    }

    if (missingColumns.length > 0) {
      return {
        success: false,
        data: [],
        errors: [`Colunas essenciais não encontradas: ${missingColumns.join(', ')}. Sugestões de nomes aceitos: Data/Date, Histórico/Descrição, Valor/Valor(R$)`],
        warnings: [],
        stats: {
          totalRows: jsonData.length - headerRowIndex - 1,
          validRows: 0,
          rowsWithWarnings: 0,
          rowsWithErrors: 0,
          totalValue: 0,
        },
      };
    }

    const parsedRows: ParsedRow[] = [];
    const warnings: string[] = [];
    let totalValue = 0;
    let validRows = 0;
    let rowsWithWarnings = 0;
    let rowsWithErrors = 0;

    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Skip completely empty rows
      if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }

      const parsedRow = parseRow(row, columnIndexes, i + 1);
      parsedRows.push(parsedRow);

      if (parsedRow.validationStatus === 'valid') {
        validRows++;
        totalValue += parsedRow.value;
      } else if (parsedRow.validationStatus === 'warning') {
        rowsWithWarnings++;
        totalValue += parsedRow.value;
        if (parsedRow.validationMessage) {
          warnings.push(`Linha ${i + 1}: ${parsedRow.validationMessage}`);
        }
      } else {
        rowsWithErrors++;
      }
    }

    return {
      success: true,
      data: parsedRows,
      errors: [],
      warnings,
      stats: {
        totalRows: parsedRows.length,
        validRows,
        rowsWithWarnings,
        rowsWithErrors,
        totalValue,
      },
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
      warnings: [],
      stats: {
        totalRows: 0,
        validRows: 0,
        rowsWithWarnings: 0,
        rowsWithErrors: 0,
        totalValue: 0,
      },
    };
  }
}

function findRealHeaderRow(jsonData: any[][]) {
  // Look through the first 10 rows to find the real header
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;
    
    const headers = row.map(h => String(h || '').toLowerCase().trim());
    const columnIndexes = findColumnIndexes(headers);
    
    // Check if we found at least date and history columns
    if (columnIndexes.date !== -1 && columnIndexes.history !== -1) {
      // Also need either value column or both credit/debit columns
      if (columnIndexes.value !== -1 || (columnIndexes.credit !== -1 && columnIndexes.debit !== -1)) {
        return {
          headerRowIndex: i,
          columnIndexes,
        };
      }
    }
  }
  
  return null;
}

function findColumnIndexes(headers: string[]) {
  const indexes = {
    date: -1,
    history: -1,
    value: -1,
    credit: -1,
    debit: -1,
  };

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();
    
    // Skip completely empty headers
    if (!normalized) return;
    
    // Check for date column
    if (indexes.date === -1 && COLUMN_MAPPINGS.date.some(name => normalized.includes(name))) {
      indexes.date = index;
    }
    
    // Check for history column
    if (indexes.history === -1 && COLUMN_MAPPINGS.history.some(name => normalized.includes(name))) {
      indexes.history = index;
    }
    
    // Check for value column
    if (indexes.value === -1 && COLUMN_MAPPINGS.value.some(name => normalized.includes(name))) {
      indexes.value = index;
    }
    
    // Check for credit column
    if (indexes.credit === -1 && COLUMN_MAPPINGS.credit.some(name => normalized.includes(name))) {
      indexes.credit = index;
    }
    
    // Check for debit column
    if (indexes.debit === -1 && COLUMN_MAPPINGS.debit.some(name => normalized.includes(name))) {
      indexes.debit = index;
    }
  });

  return indexes;
}

function parseRow(row: any[], columnIndexes: any, rowNumber: number): ParsedRow {
  const warnings: string[] = [];
  let validationStatus: 'valid' | 'warning' | 'error' = 'valid';

  // Parse date
  const dateValue = row[columnIndexes.date];
  const parsedDate = parseDate(dateValue);
  if (!parsedDate) {
    warnings.push('Data inválida');
    validationStatus = 'warning';
  }

  // Parse history and extract payment type and CPF
  const historyValue = String(row[columnIndexes.history] || '');
  const paymentType = extractPaymentType(historyValue);
  const cpf = extractCPF(historyValue);
  
  if (!cpf) {
    warnings.push('CPF não encontrado');
    if (validationStatus === 'valid') validationStatus = 'warning';
  }

  // Parse value
  let value = 0;
  if (columnIndexes.value !== -1) {
    value = parseValue(row[columnIndexes.value]);
  } else if (columnIndexes.credit !== -1 && columnIndexes.debit !== -1) {
    const credit = parseValue(row[columnIndexes.credit]);
    const debit = parseValue(row[columnIndexes.debit]);
    value = credit - debit;
  }

  if (isNaN(value)) {
    warnings.push('Valor inválido');
    validationStatus = 'error';
    value = 0;
  }

  return {
    date: parsedDate || 'Data inválida',
    paymentType: paymentType || 'OUTROS',
    cpf: cpf || '',
    value: Math.round(value * 100) / 100, // Round to 2 decimal places
    originalHistory: historyValue,
    validationStatus,
    validationMessage: warnings.length > 0 ? warnings.join(', ') : undefined,
  };
}

function parseDate(value: any): string | null {
  if (!value) return null;

  try {
    let date: Date;

    if (typeof value === 'number') {
      // Excel serial date
      date = new Date((value - 25569) * 86400 * 1000);
    } else {
      const strValue = String(value).trim();
      
      // Try different date formats
      if (strValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        // dd/mm/yyyy
        const [day, month, year] = strValue.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (strValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // yyyy-mm-dd
        date = new Date(strValue);
      } else if (strValue.match(/^\d{2}-\d{2}-\d{4}$/)) {
        // dd-mm-yyyy
        const [day, month, year] = strValue.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        // Try to parse as is
        date = new Date(strValue);
      }
    }

    if (isNaN(date.getTime())) {
      return null;
    }

    // Use the centralized formatter to ensure consistency (DD-MM-YYYY)
    return formatToDDMMYYYY(date);
  } catch {
    return null;
  }
}

function extractPaymentType(history: string): string | null {
  const upperHistory = history.toUpperCase();
  
  for (const [type, pattern] of Object.entries(PAYMENT_TYPES)) {
    if (pattern.test(history)) {
      return type;
    }
  }
  
  // Additional checks for PIX without "RECEBIDO" or "ENVIADO"
  if (upperHistory.includes('PIX')) {
    if (upperHistory.includes('ENVIO') || upperHistory.includes('TRANSF')) {
      return 'PIX ENVIADO';
    }
    return 'PIX RECEBIDO';
  }
  
  return null;
}

function extractCPF(text: string): string | null {
  // Remove all non-digit characters for easier matching
  const digitsOnly = text.replace(/\D/g, '');
  
  // Look for 11 consecutive digits that could be a CPF
  const cpfMatch = digitsOnly.match(/\d{11}/);
  
  if (cpfMatch) {
    const cpf = cpfMatch[0];
    // Basic CPF validation (not all same digits)
    if (!/^(\d)\1{10}$/.test(cpf)) {
      return cpf;
    }
  }
  
  // Try to find CPF with formatting
  const formattedMatch = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (formattedMatch) {
    return formattedMatch[0].replace(/\D/g, '');
  }
  
  return null;
}

function parseValue(value: any): number {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Remove currency symbols and spaces
    let cleanValue = value.replace(/[R$\s]/g, '');
    
    // Replace comma with dot for decimal separator
    cleanValue = cleanValue.replace(',', '.');
    
    // Remove any remaining non-numeric characters except dot and minus
    cleanValue = cleanValue.replace(/[^\d.-]/g, '');
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}