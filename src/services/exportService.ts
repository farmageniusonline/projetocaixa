import * as XLSX from 'xlsx';
import { ConferenceHistoryEntry } from './indexedDbService';
import { ActionLog } from '../lib/indexeddb';
import { formatDateTimeForDisplay, formatToDDMMYYYY } from '../utils/dateFormatter';

export interface ExportData {
  banking?: any[];
  cash?: any[];
  actions?: ActionLog[];
  history?: ConferenceHistoryEntry[];
  manual?: any[];
}

export class ExportService {
  /**
   * Format currency value for export
   */
  private static formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Export data to CSV format
   */
  static exportToCSV(data: ExportData, filename: string): void {
    const csvSections: string[] = [];

    // Banking data
    if (data.banking && data.banking.length > 0) {
      csvSections.push('DADOS BANCÁRIOS');
      csvSections.push([
        'Data',
        'Documento',
        'Descrição',
        'Valor',
        'Tipo Transação',
        'Status',
        'ID Origem'
      ].join(','));

      data.banking.forEach(item => {
        csvSections.push([
          `"${item.date || ''}"`,
          `"${item.document_number || ''}"`,
          `"${item.description?.replace(/"/g, '""') || ''}"`,
          `"${this.formatCurrency(item.value)}"`,
          `"${item.transaction_type || ''}"`,
          `"${item.status || ''}"`,
          `"${item.source_id || ''}"`
        ].join(','));
      });
      csvSections.push('');
    }

    // Cash conference data
    if (data.cash && data.cash.length > 0) {
      csvSections.push('CONFERÊNCIA DE CAIXA');
      csvSections.push([
        'Data',
        'Documento',
        'Descrição',
        'Valor',
        'Status',
        'Conferido Em',
        'Conferido Por',
        'ID Origem'
      ].join(','));

      data.cash.forEach(item => {
        csvSections.push([
          `"${item.day || ''}"`,
          `"${item.document_number || ''}"`,
          `"${item.description?.replace(/"/g, '""') || ''}"`,
          `"${this.formatCurrency(item.value)}"`,
          `"${item.status || ''}"`,
          `"${item.conferred_at ? formatDateTimeForDisplay(item.conferred_at) : ''}"`,
          `"${item.conferred_by || ''}"`,
          `"${item.source_id || ''}"`
        ].join(','));
      });
      csvSections.push('');
    }

    // Manual entries data
    if (data.manual && data.manual.length > 0) {
      csvSections.push('LANÇAMENTOS MANUAIS');
      csvSections.push([
        'Data',
        'Documento',
        'Descrição',
        'Valor',
        'Tipo',
        'Categoria',
        'Status',
        'ID Origem'
      ].join(','));

      data.manual.forEach(item => {
        csvSections.push([
          `"${item.day || ''}"`,
          `"${item.document_number || ''}"`,
          `"${item.description?.replace(/"/g, '""') || ''}"`,
          `"${this.formatCurrency(item.value)}"`,
          `"${item.entry_type || ''}"`,
          `"${item.category || ''}"`,
          `"${item.status || ''}"`,
          `"${item.source_id || ''}"`
        ].join(','));
      });
      csvSections.push('');
    }

    // Action log data
    if (data.actions && data.actions.length > 0) {
      csvSections.push('HISTÓRICO DE AÇÕES');
      csvSections.push([
        'Data/Hora',
        'Tipo de Ação',
        'Descrição',
        'Resultado',
        'Usuário',
        'Valores',
        'IDs de Origem',
        'Erro'
      ].join(','));

      data.actions.forEach(action => {
        csvSections.push([
          `"${formatDateTimeForDisplay(action.timestamp)}"`,
          `"${this.getActionTypeLabel(action.action_type)}"`,
          `"${action.action_description.replace(/"/g, '""')}"`,
          `"${action.result}"`,
          `"${action.user_id}"`,
          `"${action.payload.values?.join('; ') || ''}"`,
          `"${action.payload.source_ids?.join('; ') || ''}"`,
          `"${action.error_message || ''}"`
        ].join(','));
      });
      csvSections.push('');
    }

    // History data
    if (data.history && data.history.length > 0) {
      csvSections.push('HISTÓRICO POR DATA');
      csvSections.push([
        'Data Operação',
        'Tipo Operação',
        'Documento',
        'Descrição',
        'Valor',
        'Status',
        'Arquivo',
        'Banco'
      ].join(','));

      data.history.forEach(item => {
        csvSections.push([
          `"${item.operation_date || ''}"`,
          `"${this.getOperationTypeLabel(item.operation_type)}"`,
          `"${item.document_number || ''}"`,
          `"${item.description?.replace(/"/g, '""') || ''}"`,
          `"${this.formatCurrency(item.value)}"`,
          `"${item.status || ''}"`,
          `"${item.file_name || ''}"`,
          `"${item.bank_name || ''}"`
        ].join(','));
      });
    }

    const csvContent = csvSections.join('\n');
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Export data to XLSX format
   */
  static exportToXLSX(data: ExportData, filename: string): void {
    const workbook = XLSX.utils.book_new();

    // Banking sheet
    if (data.banking && data.banking.length > 0) {
      const bankingData = data.banking.map(item => ({
        'Data': item.date || '',
        'Documento': item.document_number || '',
        'Descrição': item.description || '',
        'Valor': item.value || 0,
        'Tipo Transação': item.transaction_type || '',
        'Status': item.status || '',
        'ID Origem': item.source_id || ''
      }));

      const bankingSheet = XLSX.utils.json_to_sheet(bankingData);
      XLSX.utils.book_append_sheet(workbook, bankingSheet, 'Bancário');
    }

    // Cash sheet
    if (data.cash && data.cash.length > 0) {
      const cashData = data.cash.map(item => ({
        'Data': item.day || '',
        'Documento': item.document_number || '',
        'Descrição': item.description || '',
        'Valor': item.value || 0,
        'Status': item.status || '',
        'Conferido Em': item.conferred_at ? formatDateTimeForDisplay(item.conferred_at) : '',
        'Conferido Por': item.conferred_by || '',
        'ID Origem': item.source_id || ''
      }));

      const cashSheet = XLSX.utils.json_to_sheet(cashData);
      XLSX.utils.book_append_sheet(workbook, cashSheet, 'Caixa');
    }

    // Manual entries sheet
    if (data.manual && data.manual.length > 0) {
      const manualData = data.manual.map(item => ({
        'Data': item.day || '',
        'Documento': item.document_number || '',
        'Descrição': item.description || '',
        'Valor': item.value || 0,
        'Tipo': item.entry_type || '',
        'Categoria': item.category || '',
        'Status': item.status || '',
        'ID Origem': item.source_id || ''
      }));

      const manualSheet = XLSX.utils.json_to_sheet(manualData);
      XLSX.utils.book_append_sheet(workbook, manualSheet, 'Lançamentos');
    }

    // Actions sheet
    if (data.actions && data.actions.length > 0) {
      const actionsData = data.actions.map(action => ({
        'Data/Hora': formatDateTimeForDisplay(action.timestamp),
        'Tipo de Ação': this.getActionTypeLabel(action.action_type),
        'Descrição': action.action_description,
        'Resultado': action.result,
        'Usuário': action.user_id,
        'Valores': action.payload.values?.join('; ') || '',
        'IDs de Origem': action.payload.source_ids?.join('; ') || '',
        'Erro': action.error_message || ''
      }));

      const actionsSheet = XLSX.utils.json_to_sheet(actionsData);
      XLSX.utils.book_append_sheet(workbook, actionsSheet, 'Ações');
    }

    // History sheet
    if (data.history && data.history.length > 0) {
      const historyData = data.history.map(item => ({
        'Data Operação': item.operation_date || '',
        'Tipo Operação': this.getOperationTypeLabel(item.operation_type),
        'Documento': item.document_number || '',
        'Descrição': item.description || '',
        'Valor': item.value || 0,
        'Status': item.status || '',
        'Arquivo': item.file_name || '',
        'Banco': item.bank_name || ''
      }));

      const historySheet = XLSX.utils.json_to_sheet(historyData);
      XLSX.utils.book_append_sheet(workbook, historySheet, 'Histórico');
    }

    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Get action type label in Portuguese
   */
  private static getActionTypeLabel(type: string): string {
    switch (type) {
      case 'banking_upload':
        return 'Upload Bancário';
      case 'cash_conference':
        return 'Conferência';
      case 'manual_entry':
        return 'Lançamento Manual';
      case 'transfer':
        return 'Transferência';
      case 'undo':
        return 'Desfazer';
      case 'not_found':
        return 'Não Encontrado';
      default:
        return type;
    }
  }

  /**
   * Get operation type label in Portuguese
   */
  private static getOperationTypeLabel(type: string): string {
    switch (type) {
      case 'banking_upload':
        return 'Upload Bancário';
      case 'cash_conference':
        return 'Conferência de Caixa';
      case 'not_found':
        return 'Não Encontrado';
      case 'manual_entry':
        return 'Lançamento Manual';
      default:
        return type;
    }
  }

  /**
   * Download file as text
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  /**
   * Download blob as file
   */
  private static downloadBlob(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename with current date
   */
  static generateFilename(prefix: string, extension: string, date?: string): string {
    const dateStr = date || formatToDDMMYYYY(new Date());
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}_${dateStr}_${timestamp}.${extension}`;
  }
}