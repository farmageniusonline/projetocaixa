import * as XLSX from 'xlsx';
import { ParsedRow } from './excelParser';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  includeStatistics?: boolean;
  includeCharts?: boolean;
  customFileName?: string;
  dateRange?: { start: Date; end: Date };
  groupBy?: 'date' | 'paymentType' | 'none';
}

export interface ExportStatistics {
  totalRecords: number;
  totalValue: number;
  averageValue: number;
  paymentTypeBreakdown: Record<string, { count: number; value: number; percentage: number }>;
  dateRange: { start: string; end: string };
  exportedAt: string;
}

/**
 * Calculate statistics for export
 */
function calculateExportStatistics(data: ParsedRow[]): ExportStatistics {
  const totalValue = data.reduce((sum, record) => sum + record.value, 0);
  const averageValue = data.length > 0 ? totalValue / data.length : 0;

  // Payment type breakdown
  const paymentTypeBreakdown: Record<string, { count: number; value: number; percentage: number }> = {};
  data.forEach(record => {
    if (!paymentTypeBreakdown[record.paymentType]) {
      paymentTypeBreakdown[record.paymentType] = { count: 0, value: 0, percentage: 0 };
    }
    paymentTypeBreakdown[record.paymentType].count++;
    paymentTypeBreakdown[record.paymentType].value += record.value;
  });

  // Calculate percentages
  Object.values(paymentTypeBreakdown).forEach(breakdown => {
    breakdown.percentage = (breakdown.value / totalValue) * 100;
  });

  // Date range
  const dates = data.map(r => {
    const [day, month, year] = r.date.split('/').map(Number);
    return new Date(year, month - 1, day);
  }).filter(d => !isNaN(d.getTime()));

  const startDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
  const endDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();

  return {
    totalRecords: data.length,
    totalValue,
    averageValue,
    paymentTypeBreakdown,
    dateRange: {
      start: startDate.toLocaleDateString('pt-BR'),
      end: endDate.toLocaleDateString('pt-BR')
    },
    exportedAt: new Date().toLocaleString('pt-BR')
  };
}

/**
 * Group data by specified criteria
 */
function groupData(data: ParsedRow[], groupBy: string) {
  if (groupBy === 'none') return { 'Todos os Registros': data };

  const grouped: Record<string, ParsedRow[]> = {};

  data.forEach(record => {
    let key: string;

    switch (groupBy) {
      case 'date':
        key = record.date;
        break;
      case 'paymentType':
        key = record.paymentType;
        break;
      default:
        key = 'Todos os Registros';
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(record);
  });

  return grouped;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(data: ParsedRow[], options: ExportOptions = { format: 'csv' }): void {
  const fileName = options.customFileName || `relatorio-${new Date().toISOString().split('T')[0]}.csv`;
  const statistics = options.includeStatistics ? calculateExportStatistics(data) : null;

  const headers = ['Data', 'Tipo de Pagamento', 'CPF', 'Valor (R$)', 'Histórico Original', 'Status'];
  let csvContent = '';

  // Add statistics if requested
  if (statistics) {
    csvContent += 'RELATÓRIO DE CONFERÊNCIA BANCÁRIA\n';
    csvContent += `Período: ${statistics.dateRange.start} a ${statistics.dateRange.end}\n`;
    csvContent += `Total de Registros: ${statistics.totalRecords}\n`;
    csvContent += `Valor Total: ${statistics.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    csvContent += `Valor Médio: ${statistics.averageValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    csvContent += `Exportado em: ${statistics.exportedAt}\n\n`;

    csvContent += 'BREAKDOWN POR TIPO DE PAGAMENTO\n';
    csvContent += 'Tipo,Quantidade,Valor Total,Percentual\n';
    Object.entries(statistics.paymentTypeBreakdown).forEach(([type, breakdown]) => {
      csvContent += `"${type}",${breakdown.count},"${breakdown.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}",${breakdown.percentage.toFixed(2)}%\n`;
    });
    csvContent += '\n';
  }

  // Group data if requested
  const groupedData = groupData(data, options.groupBy || 'none');

  Object.entries(groupedData).forEach(([groupName, records]) => {
    if (options.groupBy !== 'none') {
      csvContent += `GRUPO: ${groupName}\n`;
    }

    csvContent += headers.join(',') + '\n';

    records.forEach(record => {
      const row = [
        record.date,
        `"${record.paymentType}"`,
        record.cpf,
        record.value.toFixed(2).replace('.', ','),
        `"${record.originalHistory.replace(/"/g, '""')}"`,
        record.validationStatus || 'valid'
      ];
      csvContent += row.join(',') + '\n';
    });

    if (options.groupBy !== 'none') {
      csvContent += '\n';
    }
  });

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to Excel format
 */
export function exportToXLSX(data: ParsedRow[], options: ExportOptions = { format: 'xlsx' }): void {
  const fileName = options.customFileName || `relatorio-${new Date().toISOString().split('T')[0]}.xlsx`;
  const workbook = XLSX.utils.book_new();
  const statistics = options.includeStatistics ? calculateExportStatistics(data) : null;

  // Create main data sheet
  const mainHeaders = ['Data', 'Tipo de Pagamento', 'CPF', 'Valor (R$)', 'Histórico Original', 'Status'];
  const mainData = data.map(record => [
    record.date,
    record.paymentType,
    record.cpf,
    record.value,
    record.originalHistory,
    record.validationStatus || 'valid'
  ]);

  const mainSheet = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainData]);

  // Apply formatting to value column (make it currency)
  const range = XLSX.utils.decode_range(mainSheet['!ref'] || 'A1:F1');
  for (let row = 1; row <= range.e.r; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: 3 }); // Column D (Value)
    if (mainSheet[cellAddress] && typeof mainSheet[cellAddress].v === 'number') {
      mainSheet[cellAddress].z = '"R$" #,##0.00';
    }
  }

  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Dados');

  // Add statistics sheet if requested
  if (statistics) {
    const statsData = [
      ['RELATÓRIO DE CONFERÊNCIA BANCÁRIA'],
      [''],
      ['Período:', `${statistics.dateRange.start} a ${statistics.dateRange.end}`],
      ['Total de Registros:', statistics.totalRecords],
      ['Valor Total:', statistics.totalValue],
      ['Valor Médio:', statistics.averageValue],
      ['Exportado em:', statistics.exportedAt],
      [''],
      ['BREAKDOWN POR TIPO DE PAGAMENTO'],
      ['Tipo', 'Quantidade', 'Valor Total', 'Percentual'],
      ...Object.entries(statistics.paymentTypeBreakdown).map(([type, breakdown]) => [
        type,
        breakdown.count,
        breakdown.value,
        breakdown.percentage / 100 // Excel percentage format
      ])
    ];

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Estatísticas');
  }

  // Add grouped sheets if requested
  if (options.groupBy && options.groupBy !== 'none') {
    const groupedData = groupData(data, options.groupBy);

    Object.entries(groupedData).forEach(([groupName, records]) => {
      const groupHeaders = ['Data', 'Tipo de Pagamento', 'CPF', 'Valor (R$)', 'Histórico Original', 'Status'];
      const groupData = records.map(record => [
        record.date,
        record.paymentType,
        record.cpf,
        record.value,
        record.originalHistory,
        record.validationStatus || 'valid'
      ]);

      const groupSheet = XLSX.utils.aoa_to_sheet([groupHeaders, ...groupData]);
      const safeSheetName = groupName.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(workbook, groupSheet, safeSheetName);
    });
  }

  // Download file
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export data to PDF format
 */
export function exportToPDF(data: ParsedRow[], options: ExportOptions = { format: 'pdf' }): void {
  const fileName = options.customFileName || `relatorio-${new Date().toISOString().split('T')[0]}.pdf`;
  const doc = new jsPDF();
  const statistics = options.includeStatistics ? calculateExportStatistics(data) : null;

  let yPosition = 20;
  const lineHeight = 6;
  const pageHeight = doc.internal.pageSize.height;

  // Add title
  doc.setFontSize(16);
  doc.text('Relatório de Conferência Bancária', 20, yPosition);
  yPosition += lineHeight * 2;

  // Add statistics if requested
  if (statistics) {
    doc.setFontSize(12);
    doc.text(`Período: ${statistics.dateRange.start} a ${statistics.dateRange.end}`, 20, yPosition);
    yPosition += lineHeight;
    doc.text(`Total de Registros: ${statistics.totalRecords}`, 20, yPosition);
    yPosition += lineHeight;
    doc.text(`Valor Total: ${statistics.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += lineHeight;
    doc.text(`Valor Médio: ${statistics.averageValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += lineHeight;
    doc.text(`Exportado em: ${statistics.exportedAt}`, 20, yPosition);
    yPosition += lineHeight * 2;

    // Payment type breakdown
    doc.setFontSize(14);
    doc.text('Breakdown por Tipo de Pagamento:', 20, yPosition);
    yPosition += lineHeight;

    doc.setFontSize(10);
    Object.entries(statistics.paymentTypeBreakdown).forEach(([type, breakdown]) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(`${type}: ${breakdown.count} registros - ${breakdown.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${breakdown.percentage.toFixed(2)}%)`, 20, yPosition);
      yPosition += lineHeight;
    });

    yPosition += lineHeight;
  }

  // Add data table
  doc.setFontSize(12);
  doc.text('Detalhes dos Registros:', 20, yPosition);
  yPosition += lineHeight * 2;

  // Group data if requested
  const groupedData = groupData(data, options.groupBy || 'none');

  Object.entries(groupedData).forEach(([groupName, records]) => {
    if (options.groupBy !== 'none') {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFontSize(12);
      doc.text(`Grupo: ${groupName}`, 20, yPosition);
      yPosition += lineHeight * 1.5;
    }

    doc.setFontSize(8);

    // Table headers
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }

    doc.text('Data', 20, yPosition);
    doc.text('Tipo', 50, yPosition);
    doc.text('CPF', 80, yPosition);
    doc.text('Valor', 110, yPosition);
    doc.text('Histórico', 140, yPosition);
    yPosition += lineHeight;

    // Table data (limited to avoid huge PDFs)
    const limitedRecords = records.slice(0, 100); // Limit to first 100 records

    limitedRecords.forEach(record => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
        // Repeat headers on new page
        doc.text('Data', 20, yPosition);
        doc.text('Tipo', 50, yPosition);
        doc.text('CPF', 80, yPosition);
        doc.text('Valor', 110, yPosition);
        doc.text('Histórico', 140, yPosition);
        yPosition += lineHeight;
      }

      doc.text(record.date, 20, yPosition);
      doc.text(record.paymentType.substring(0, 12), 50, yPosition);
      doc.text(record.cpf.substring(0, 14), 80, yPosition);
      doc.text(`R$ ${record.value.toFixed(2)}`, 110, yPosition);
      doc.text(record.originalHistory.substring(0, 30), 140, yPosition);
      yPosition += lineHeight;
    });

    if (records.length > 100) {
      yPosition += lineHeight;
      doc.text(`... e mais ${records.length - 100} registros`, 20, yPosition);
    }

    yPosition += lineHeight * 2;
  });

  // Save the PDF
  doc.save(fileName);
}

/**
 * Export data to JSON format
 */
export function exportToJSON(data: ParsedRow[], options: ExportOptions = { format: 'json' }): void {
  const fileName = options.customFileName || `relatorio-${new Date().toISOString().split('T')[0]}.json`;
  const statistics = options.includeStatistics ? calculateExportStatistics(data) : null;

  const exportData: any = {
    metadata: {
      exportedAt: new Date().toISOString(),
      totalRecords: data.length,
      format: 'banking-conference-data-v1'
    },
    data: data
  };

  if (statistics) {
    exportData.statistics = statistics;
  }

  if (options.groupBy && options.groupBy !== 'none') {
    exportData.groupedData = groupData(data, options.groupBy);
  }

  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Main export function that routes to specific exporters
 */
export function exportData(data: ParsedRow[], options: ExportOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      switch (options.format) {
        case 'csv':
          exportToCSV(data, options);
          break;
        case 'xlsx':
          exportToXLSX(data, options);
          break;
        case 'pdf':
          exportToPDF(data, options);
          break;
        case 'json':
          exportToJSON(data, options);
          break;
        default:
          throw new Error(`Formato de exportação não suportado: ${options.format}`);
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get export format options with descriptions
 */
export const exportFormats = [
  {
    value: 'csv',
    label: 'CSV (Comma Separated Values)',
    description: 'Formato universal, compatível com Excel e outros programas',
    icon: '📊',
    fileExtension: '.csv'
  },
  {
    value: 'xlsx',
    label: 'Excel (XLSX)',
    description: 'Planilha do Excel com formatação e múltiplas abas',
    icon: '📈',
    fileExtension: '.xlsx'
  },
  {
    value: 'pdf',
    label: 'PDF (Portable Document Format)',
    description: 'Documento formatado para impressão e visualização',
    icon: '📄',
    fileExtension: '.pdf'
  },
  {
    value: 'json',
    label: 'JSON (JavaScript Object Notation)',
    description: 'Formato estruturado para integração com sistemas',
    icon: '🔧',
    fileExtension: '.json'
  }
] as const;