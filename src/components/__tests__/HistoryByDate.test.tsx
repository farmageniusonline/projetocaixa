import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistoryByDate } from '../HistoryByDate';
import * as conferenceHistory from '../../services/conferenceHistory';

vi.mock('../../services/conferenceHistory');

describe('HistoryByDate', () => {
  const mockOnDataLoaded = vi.fn();

  const mockHistoryData = [
    {
      id: '1',
      operation_date: '2024-01-15',
      operation_type: 'banking_upload' as const,
      document_number: 'DOC001',
      description: 'Test transaction',
      value: 100,
      status: 'pending' as const,
      operation_timestamp: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      operation_date: '2024-01-15',
      operation_type: 'cash_conference' as const,
      document_number: 'DOC002',
      value: 200,
      status: 'conferred' as const,
      operation_timestamp: '2024-01-15T11:00:00Z'
    },
    {
      id: '3',
      operation_date: '2024-01-15',
      operation_type: 'not_found' as const,
      value: 50,
      status: 'not_found' as const,
      operation_timestamp: '2024-01-15T12:00:00Z'
    }
  ];

  const mockDailySummary = {
    operation_date: '2024-01-15',
    banking_total_uploaded: 5,
    banking_total_value: 1000,
    banking_conferred_count: 3,
    banking_conferred_value: 600,
    cash_conferred_count: 2,
    cash_conferred_value: 400,
    cash_not_found_count: 1,
    last_file_name: 'test.xlsx',
    last_upload_timestamp: '2024-01-15T09:00:00Z',
    total_conferred: 5,
    total_value: 1000
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default date (today)', () => {
    render(<HistoryByDate />);

    // Now the input has an id and proper label association
    const dateInput = document.getElementById('history-date-input') as HTMLInputElement;
    const today = new Date().toISOString().split('T')[0];
    expect(dateInput).toBeTruthy();
    expect(dateInput?.value).toBe(today);
  });

  it('allows changing date period', () => {
    render(<HistoryByDate />);

    // Now the select has an id and proper label association
    const periodSelect = document.getElementById('period-select') as HTMLSelectElement;
    expect(periodSelect).toBeTruthy();

    fireEvent.change(periodSelect, { target: { value: 'week' } });
    expect(periodSelect.value).toBe('week');
  });

  it('loads history data when button is clicked', async () => {
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDate).mockResolvedValue(mockHistoryData);
    vi.mocked(conferenceHistory.ConferenceHistoryService.getDailySummary).mockResolvedValue(mockDailySummary);

    render(<HistoryByDate onDataLoaded={mockOnDataLoaded} />);

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(conferenceHistory.ConferenceHistoryService.getHistoryByDate).toHaveBeenCalled();
      expect(mockOnDataLoaded).toHaveBeenCalledWith(mockHistoryData);
    });
  });

  it('displays daily summary when data is loaded', async () => {
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDate).mockResolvedValue(mockHistoryData);
    vi.mocked(conferenceHistory.ConferenceHistoryService.getDailySummary).mockResolvedValue(mockDailySummary);

    render(<HistoryByDate />);

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/Resumo do Dia/i)).toBeInTheDocument();
      expect(screen.getByText(/Uploads:/i)).toBeInTheDocument();
      // Use getAllByText since there might be multiple "5" elements and check the first one
      const fiveElements = screen.getAllByText(/^5$/);
      expect(fiveElements.length).toBeGreaterThan(0);
    });
  });

  it('groups history data by operation type', async () => {
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDate).mockResolvedValue(mockHistoryData);
    vi.mocked(conferenceHistory.ConferenceHistoryService.getDailySummary).mockResolvedValue(mockDailySummary);

    render(<HistoryByDate />);

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload Bancário/i)).toBeInTheDocument();
      expect(screen.getByText(/Conferência de Caixa/i)).toBeInTheDocument();
      expect(screen.getByText(/DOC001/)).toBeInTheDocument();
      expect(screen.getByText(/DOC002/)).toBeInTheDocument();
    });
  });

  it('shows error message when no data is found', async () => {
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDate).mockResolvedValue([]);
    vi.mocked(conferenceHistory.ConferenceHistoryService.getDailySummary).mockResolvedValue(null);

    render(<HistoryByDate />);

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching data', async () => {
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDate).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockHistoryData), 100))
    );

    render(<HistoryByDate />);

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    expect(screen.getByText(/Carregando.../i)).toBeInTheDocument();
  });

  it('loads data for date range when period is changed', async () => {
    // Create unique data for range test to avoid duplicate keys
    const rangeData = [
      { ...mockHistoryData[0], id: '4' },
      { ...mockHistoryData[1], id: '5' },
      { ...mockHistoryData[2], id: '6' }
    ];
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDateRange).mockResolvedValue(rangeData);

    render(<HistoryByDate />);

    const periodSelect = document.getElementById('period-select') as HTMLSelectElement;
    fireEvent.change(periodSelect, { target: { value: 'week' } });

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(conferenceHistory.ConferenceHistoryService.getHistoryByDateRange).toHaveBeenCalled();
    });
  });

  it('handles today button click', () => {
    render(<HistoryByDate />);

    const dateInput = document.getElementById('history-date-input') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-01-01' } });

    const todayButton = screen.getByText(/Hoje/i);
    fireEvent.click(todayButton);

    const today = new Date().toISOString().split('T')[0];
    expect(dateInput.value).toBe(today);
  });

  it('displays status badges correctly', async () => {
    vi.mocked(conferenceHistory.ConferenceHistoryService.getHistoryByDate).mockResolvedValue(mockHistoryData);
    vi.mocked(conferenceHistory.ConferenceHistoryService.getDailySummary).mockResolvedValue(mockDailySummary);

    render(<HistoryByDate />);

    const loadButton = screen.getByText(/Carregar Histórico/i);
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/Pendente/i)).toBeInTheDocument();
      // Use getAllByText for elements that might appear multiple times
      const conferidoElements = screen.getAllByText(/Conferido/i);
      expect(conferidoElements.length).toBeGreaterThan(0);
      // "Não Encontrado" appears as badge text
      const notFoundElements = screen.getAllByText(/Não Encontrado/i);
      expect(notFoundElements.length).toBeGreaterThan(0);
    });
  });
});