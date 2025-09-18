import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LaunchTab } from './LaunchTab';
import toast from 'react-hot-toast';

// Mock hooks
vi.mock('../hooks/usePersistentState', () => ({
  useDashboardFilters: () => [
    { selectedDate: '', conferenceValue: '' },
    vi.fn()
  ]
}));

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
  useFocusRestore: () => ({
    saveFocus: vi.fn(),
    restoreFocus: vi.fn()
  })
}));

describe('LaunchTab Component', () => {
  const mockProps = {
    currentDate: new Date(2024, 0, 1),
    operationDate: '01/01/2024',
    onLaunchAdded: vi.fn(),
    conferredItems: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render all payment methods', () => {
      render(<LaunchTab {...mockProps} />);

      expect(screen.getByText('Cartão de Crédito 1x')).toBeInTheDocument();
      expect(screen.getByText('Cartão de Crédito 2x')).toBeInTheDocument();
      expect(screen.getByText('Cartão de Crédito 3x')).toBeInTheDocument();
      expect(screen.getByText('Cartão de Crédito 4x')).toBeInTheDocument();
      expect(screen.getByText('Cartão de Crédito 5x')).toBeInTheDocument();
      expect(screen.getByText('Débito')).toBeInTheDocument();
      expect(screen.getByText('Dinheiro')).toBeInTheDocument();
      expect(screen.getByText('Moedas')).toBeInTheDocument();
      expect(screen.getByText('Depósito')).toBeInTheDocument();
    });

    it('should render value input field', () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      expect(valueInput).toBeInTheDocument();
      expect(valueInput).toHaveAttribute('id', 'launch-value-input');
    });

    it('should render dark theme correctly', () => {
      const { container } = render(<LaunchTab {...mockProps} />);

      const darkElements = container.querySelectorAll('.bg-gray-800, .bg-gray-900, .bg-gray-700');
      expect(darkElements.length).toBeGreaterThan(0);

      const textElements = container.querySelectorAll('.text-gray-100, .text-gray-300');
      expect(textElements.length).toBeGreaterThan(0);
    });
  });

  describe('Payment Selection', () => {
    it('should select payment method on click', async () => {
      render(<LaunchTab {...mockProps} />);

      const creditButton = screen.getByText('Cartão de Crédito 1x');
      await userEvent.click(creditButton);

      expect(creditButton.parentElement).toHaveClass('bg-indigo-600');
    });

    it('should show "É link?" option for credit cards', async () => {
      render(<LaunchTab {...mockProps} />);

      const creditButton = screen.getByText('Cartão de Crédito 2x');
      await userEvent.click(creditButton);

      expect(screen.getByText('É link?')).toBeInTheDocument();
      expect(screen.getByText('Sim')).toBeInTheDocument();
      expect(screen.getByText('Não')).toBeInTheDocument();
    });

    it('should not show "É link?" for non-credit payments', async () => {
      render(<LaunchTab {...mockProps} />);

      const debitButton = screen.getByText('Débito');
      await userEvent.click(debitButton);

      expect(screen.queryByText('É link?')).not.toBeInTheDocument();
    });

    it('should handle link selection', async () => {
      render(<LaunchTab {...mockProps} />);

      const creditButton = screen.getByText('Cartão de Crédito 3x');
      await userEvent.click(creditButton);

      const simButton = screen.getByText('Sim');
      await userEvent.click(simButton);

      expect(simButton).toHaveClass('bg-green-600');

      const naoButton = screen.getByText('Não');
      await userEvent.click(naoButton);

      expect(naoButton).toHaveClass('bg-red-600');
      expect(simButton).not.toHaveClass('bg-green-600');
    });
  });

  describe('Value Input and Validation', () => {
    it('should validate value input in real-time', async () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      await userEvent.type(valueInput, 'abc');
      expect(screen.getByText(/valor inválido/i)).toBeInTheDocument();

      await userEvent.clear(valueInput);
      await userEvent.type(valueInput, '123,45');
      expect(screen.queryByText(/valor inválido/i)).not.toBeInTheDocument();
    });

    it('should format currency correctly', async () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      await userEvent.type(valueInput, '1234,56');
      expect(valueInput).toHaveValue('1234,56');
    });

    it('should handle decimal values', async () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      await userEvent.type(valueInput, '0,01');
      expect(valueInput).toHaveValue('0,01');
    });
  });

  describe('Adding Launches', () => {
    it('should add launch successfully', async () => {
      render(<LaunchTab {...mockProps} />);

      // Select payment method
      await userEvent.click(screen.getByText('Dinheiro'));

      // Enter value
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');

      // Click add button
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        expect(mockProps.onLaunchAdded).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 100,
            description: expect.stringContaining('Dinheiro')
          })
        );
      });

      expect(valueInput).toHaveValue('');
    });

    it('should require payment method selection', async () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');

      await userEvent.click(screen.getByText('Adicionar'));

      expect(screen.getByText('Selecione um método de pagamento')).toBeInTheDocument();
      expect(mockProps.onLaunchAdded).not.toHaveBeenCalled();
    });

    it('should require link selection for credit cards', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Cartão de Crédito 1x'));

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');

      await userEvent.click(screen.getByText('Adicionar'));

      expect(screen.getByText('Informe se é link (Sim/Não)')).toBeInTheDocument();
    });

    it('should add launch with link information', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Cartão de Crédito 2x'));
      await userEvent.click(screen.getByText('Sim')); // É link

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '200,00');

      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        expect(mockProps.onLaunchAdded).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 200,
            description: expect.stringContaining('Link: Sim')
          })
        );
      });
    });
  });

  describe('Launch Table', () => {
    it('should display added launches in table', async () => {
      const { rerender } = render(<LaunchTab {...mockProps} />);

      // Add a launch
      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '50,00');
      await userEvent.click(screen.getByText('Adicionar'));

      // Re-render to update table
      rerender(<LaunchTab {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
      });
    });

    it('should show total values in footer', async () => {
      render(<LaunchTab {...mockProps} />);

      // Add multiple launches
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      // Add cash launch
      await userEvent.click(screen.getByText('Dinheiro'));
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      // Add debit launch
      await userEvent.click(screen.getByText('Débito'));
      await userEvent.clear(valueInput);
      await userEvent.type(valueInput, '200,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        expect(screen.getByText('Total Geral')).toBeInTheDocument();
      });
    });
  });

  describe('Undo Functionality', () => {
    it('should show undo button for each launch', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        expect(screen.getByText('Desfazer')).toBeInTheDocument();
      });
    });

    it('should show confirmation modal on undo click', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        const undoButton = screen.getByText('Desfazer');
        userEvent.click(undoButton);
      });

      expect(screen.getByText('Confirmar Desfazer')).toBeInTheDocument();
      expect(screen.getByText(/Tem certeza que deseja desfazer/)).toBeInTheDocument();
    });

    it('should remove launch on undo confirmation', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(async () => {
        await userEvent.click(screen.getByText('Desfazer'));
        await userEvent.click(screen.getByText('Confirmar'));
      });

      expect(mockProps.onLaunchAdded).toHaveBeenCalledWith(
        expect.objectContaining({
          remove: true
        })
      );
    });

    it('should cancel undo on Esc key', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        userEvent.click(screen.getByText('Desfazer'));
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Confirmar Desfazer')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should add launch on Enter key', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');

      fireEvent.keyDown(valueInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockProps.onLaunchAdded).toHaveBeenCalled();
      });
    });

    it('should focus value input on Ctrl+L', () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      fireEvent.keyDown(document, { key: 'l', ctrlKey: true });

      expect(document.activeElement).toBe(valueInput);
    });

    it('should return focus to input after action', async () => {
      render(<LaunchTab {...mockProps} />);

      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      await userEvent.click(screen.getByText('Dinheiro'));
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await waitFor(() => {
        expect(document.activeElement).toBe(valueInput);
      });
    });
  });

  describe('Filters', () => {
    it('should filter by payment type', async () => {
      render(<LaunchTab {...mockProps} />);

      // Add launches of different types
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');

      await userEvent.click(screen.getByText('Dinheiro'));
      await userEvent.type(valueInput, '100,00');
      await userEvent.click(screen.getByText('Adicionar'));

      await userEvent.click(screen.getByText('Débito'));
      await userEvent.clear(valueInput);
      await userEvent.type(valueInput, '200,00');
      await userEvent.click(screen.getByText('Adicionar'));

      // Apply filter
      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'cash');

      // Verify filtered results
      await waitFor(() => {
        expect(screen.getByText('R$ 100,00')).toBeInTheDocument();
        expect(screen.queryByText('R$ 200,00')).not.toBeInTheDocument();
      });
    });

    it('should clear filters', async () => {
      render(<LaunchTab {...mockProps} />);

      const filterSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(filterSelect, 'debit');

      await userEvent.click(screen.getByText('Limpar Filtros'));

      expect(filterSelect).toHaveValue('all');
    });
  });

  describe('Date Filtering', () => {
    it('should filter launches by date', async () => {
      render(<LaunchTab {...mockProps} />);

      const dateInput = screen.getByLabelText(/Data específica/);
      await userEvent.type(dateInput, '2024-01-02');

      await userEvent.click(screen.getByText('Aplicar'));

      expect(screen.getByText(/02\/01\/2024/)).toBeInTheDocument();
    });

    it('should show message when no launches for date', () => {
      render(<LaunchTab {...mockProps} />);

      expect(screen.getByText('Nenhum lançamento registrado para esta data')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should add launch within 150ms', async () => {
      render(<LaunchTab {...mockProps} />);

      await userEvent.click(screen.getByText('Dinheiro'));
      const valueInput = screen.getByPlaceholderText('Digite o valor (ex: 123,45)');
      await userEvent.type(valueInput, '100,00');

      const startTime = performance.now();
      await userEvent.click(screen.getByText('Adicionar'));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(150);
    });
  });
});