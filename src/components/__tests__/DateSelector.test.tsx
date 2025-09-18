import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DateSelector } from '../DateSelector';
import * as excelParser from '../../utils/excelParser';

vi.mock('../../utils/excelParser');

describe('DateSelector', () => {
  const mockOnDateSelected = vi.fn();
  const mockFile = new File(['test'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with automatic mode selected by default', () => {
    render(
      <DateSelector
        selectedFile={null}
        onDateSelected={mockOnDateSelected}
      />
    );

    const automaticRadio = screen.getByLabelText(/Data Automática/i);
    expect(automaticRadio).toBeChecked();
  });

  it('switches to manual mode when selected', () => {
    render(
      <DateSelector
        selectedFile={null}
        onDateSelected={mockOnDateSelected}
      />
    );

    const manualRadio = screen.getByLabelText(/Selecionar Manualmente/i);
    fireEvent.click(manualRadio);

    expect(manualRadio).toBeChecked();
    // Use aria-label or id to find the date input
    expect(screen.getByLabelText(/Selecionar data manualmente/i)).toBeInTheDocument();
  });

  it('detects date from file automatically', async () => {
    const mockParseResult = {
      success: true,
      data: [
        { date: '2024-01-15', value: 100 },
        { date: '2024-01-15', value: 200 },
      ],
      stats: { totalRows: 2, validRows: 2 },
      warnings: [],
      errors: []
    };

    vi.mocked(excelParser.parseExcelFile).mockResolvedValue(mockParseResult);

    render(
      <DateSelector
        selectedFile={mockFile}
        onDateSelected={mockOnDateSelected}
      />
    );

    await waitFor(() => {
      expect(mockOnDateSelected).toHaveBeenCalledWith('15-01-2024', 'automatic');
    });
  });

  it('uses current date when no valid dates found in file', async () => {
    const mockParseResult = {
      success: true,
      data: [],
      stats: { totalRows: 0, validRows: 0 },
      warnings: [],
      errors: []
    };

    vi.mocked(excelParser.parseExcelFile).mockResolvedValue(mockParseResult);

    const today = new Date();
    const expectedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;

    render(
      <DateSelector
        selectedFile={mockFile}
        onDateSelected={mockOnDateSelected}
      />
    );

    await waitFor(() => {
      expect(mockOnDateSelected).toHaveBeenCalledWith(expectedDate, 'automatic');
    });
  });

  it('calls onDateSelected when manual date is changed', () => {
    render(
      <DateSelector
        selectedFile={null}
        onDateSelected={mockOnDateSelected}
      />
    );

    const manualRadio = screen.getByLabelText(/Selecionar Manualmente/i);
    fireEvent.click(manualRadio);

    const dateInput = screen.getByLabelText(/Selecionar data manualmente/i);
    fireEvent.change(dateInput, { target: { value: '2024-03-20' } });

    expect(mockOnDateSelected).toHaveBeenCalledWith('20-03-2024', 'manual');
  });

  it('shows loading state while detecting date', async () => {
    const mockParseResult = {
      success: true,
      data: [{ date: '2024-01-15', value: 100 }],
      stats: { totalRows: 1, validRows: 1 },
      warnings: [],
      errors: []
    };

    vi.mocked(excelParser.parseExcelFile).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(mockParseResult), 100))
    );

    render(
      <DateSelector
        selectedFile={mockFile}
        onDateSelected={mockOnDateSelected}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Detectando data do arquivo/i)).toBeInTheDocument();
    });
  });

  it('displays formatted date correctly', () => {
    render(
      <DateSelector
        selectedFile={null}
        onDateSelected={mockOnDateSelected}
      />
    );

    const dateDisplay = screen.getByText(/Data selecionada:/i);
    expect(dateDisplay).toBeInTheDocument();
  });

  it('shows error message when date detection fails', async () => {
    vi.mocked(excelParser.parseExcelFile).mockRejectedValue(new Error('Parse error'));

    render(
      <DateSelector
        selectedFile={mockFile}
        onDateSelected={mockOnDateSelected}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Erro ao detectar data/i)).toBeInTheDocument();
    });
  });
});