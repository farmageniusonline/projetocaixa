import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LaunchTab } from '../LaunchTab';

// Mock the hooks
vi.mock('../../hooks/usePersistentState', () => ({
  useDashboardFilters: () => [
    { selectedDate: '2024-01-15', conferenceValue: '' },
    vi.fn()
  ]
}));

const mockProps = {
  currentDate: new Date('2024-01-15'),
  operationDate: '15/01/2024',
  onLaunchAdded: vi.fn(),
  conferredItems: []
};

describe('LaunchTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it('renders the launch tab with all main sections', () => {
    render(<LaunchTab {...mockProps} />);

    expect(screen.getByText('Selecionar Pagamento')).toBeInTheDocument();
    expect(screen.getByText('Preencher Valor')).toBeInTheDocument();
    expect(screen.getByText('Filtrar por Data')).toBeInTheDocument();
    expect(screen.getByText('Lançamentos Manuais')).toBeInTheDocument();
  });

  it('displays payment method options', () => {
    render(<LaunchTab {...mockProps} />);

    expect(screen.getByText('Cartão de Crédito 1x')).toBeInTheDocument();
    expect(screen.getByText('Cartão de Crédito 2x')).toBeInTheDocument();
    expect(screen.getByText('Débito')).toBeInTheDocument();
    expect(screen.getByText('Dinheiro')).toBeInTheDocument();
    expect(screen.getByText('Moedas')).toBeInTheDocument();
    expect(screen.getByText('Depósito')).toBeInTheDocument();
  });

  it('shows link option when credit card is selected', async () => {
    const user = userEvent.setup();
    render(<LaunchTab {...mockProps} />);

    const creditButton = screen.getByText('Cartão de Crédito 1x');
    await user.click(creditButton);

    expect(screen.getByText('É link?')).toBeInTheDocument();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
  });

  it('validates required fields when adding launch', async () => {
    const user = userEvent.setup();
    render(<LaunchTab {...mockProps} />);

    const addButton = screen.getByText('Adicionar');
    await user.click(addButton);

    expect(screen.getByText('Selecione um método de pagamento')).toBeInTheDocument();
  });

  it('requires link selection for credit card payments', async () => {
    const user = userEvent.setup();
    render(<LaunchTab {...mockProps} />);

    // Select credit card
    const creditButton = screen.getByText('Cartão de Crédito 1x');
    await user.click(creditButton);

    // Add value
    const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
    await user.type(valueInput, '100,50');

    // Try to add without selecting link
    const addButton = screen.getByText('Adicionar');
    await user.click(addButton);

    expect(screen.getByText('Informe se é link (Sim/Não)')).toBeInTheDocument();
  });

  it('adds launch successfully when all fields are valid', async () => {
    const user = userEvent.setup();
    const mockOnLaunchAdded = vi.fn();

    render(<LaunchTab {...mockProps} onLaunchAdded={mockOnLaunchAdded} />);

    // Select payment method
    const debitButton = screen.getByText('Débito');
    await user.click(debitButton);

    // Add value
    const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
    await user.type(valueInput, '100,50');

    // Add launch
    const addButton = screen.getByText('Adicionar');
    await user.click(addButton);

    // Check success message
    await waitFor(() => {
      expect(screen.getByText('Lançamento criado e enviado para Conferência de Caixa')).toBeInTheDocument();
    });

    // Check that callback was called
    expect(mockOnLaunchAdded).toHaveBeenCalled();
  });

  it('displays filter controls', () => {
    render(<LaunchTab {...mockProps} />);

    expect(screen.getByText('Aplicar')).toBeInTheDocument();
    expect(screen.getByText('Hoje')).toBeInTheDocument();
    expect(screen.getByText('Limpar')).toBeInTheDocument();
  });

  it('shows table with correct columns', () => {
    render(<LaunchTab {...mockProps} />);

    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Pagamento')).toBeInTheDocument();
    expect(screen.getByText('Crédito 1x')).toBeInTheDocument();
    expect(screen.getByText('Crédito 2x')).toBeInTheDocument();
    expect(screen.getByText('Crédito 3x')).toBeInTheDocument();
    expect(screen.getByText('Crédito 4x')).toBeInTheDocument();
    expect(screen.getByText('Crédito 5x')).toBeInTheDocument();
    expect(screen.getByText('Valor (R$)')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
  });

  it('validates numeric value input', async () => {
    const user = userEvent.setup();
    render(<LaunchTab {...mockProps} />);

    // Select payment method
    const debitButton = screen.getByText('Débito');
    await user.click(debitButton);

    // Try invalid value
    const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
    await user.type(valueInput, 'invalid');

    const addButton = screen.getByText('Adicionar');
    await user.click(addButton);

    expect(screen.getByText('Digite um valor válido maior que zero')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<LaunchTab {...mockProps} />);

    // Select payment method
    const debitButton = screen.getByText('Débito');
    await user.click(debitButton);

    // Focus value input and type
    const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
    await user.click(valueInput);
    await user.type(valueInput, '100,50');

    // Press Enter to submit
    await user.keyboard('{Enter}');

    // Check success message
    await waitFor(() => {
      expect(screen.getByText('Lançamento criado e enviado para Conferência de Caixa')).toBeInTheDocument();
    });
  });
});