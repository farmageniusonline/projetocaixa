/**
 * Comprehensive unit tests for FuzzySearchModal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FuzzySearchModal } from '../FuzzySearchModal';
import { createParsedRow } from '../../test/factories/advanced-factories';
import type { ParsedRow } from '../../types';

// Mock fuzzy search utilities
const mockSmartValueSearch = vi.fn();
const mockGetRecentSearchSuggestions = vi.fn();
const mockSaveRecentSearch = vi.fn();

vi.mock('../../utils/fuzzySearch', () => ({
  smartValueSearch: mockSmartValueSearch,
  getRecentSearchSuggestions: mockGetRecentSearchSuggestions,
  saveRecentSearch: mockSaveRecentSearch
}));

// Mock input sanitization
const mockSanitizeInput = vi.fn();
vi.mock('../../utils/input-sanitization', () => ({
  sanitizeInput: mockSanitizeInput
}));

// Mock data generator
const createMockData = (count: number = 5): (ParsedRow & { id?: string })[] => {
  return Array.from({ length: count }, (_, index) =>
    createParsedRow()
      .with({
        value: 100 + index * 10,
        originalHistory: `Test transaction ${index + 1}`,
        id: `test-id-${index + 1}`
      })
      .build()
  );
};

// Mock search results
const createMockSearchResults = () => ({
  exactMatches: [
    {
      item: createParsedRow().with({ value: 150, originalHistory: 'Exact match' }).build(),
      score: 1.0,
      type: 'exact' as const
    }
  ],
  closeMatches: [
    {
      item: createParsedRow().with({ value: 149, originalHistory: 'Close match' }).build(),
      score: 0.9,
      type: 'close' as const
    }
  ],
  fuzzyMatches: [
    {
      item: createParsedRow().with({ value: 145, originalHistory: 'Fuzzy match' }).build(),
      score: 0.7,
      type: 'fuzzy' as const
    }
  ],
  suggestions: ['150', '149', '145']
});

// Default props
const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  data: createMockData(),
  transferredIds: new Set<string>(),
  onSelect: vi.fn(),
  initialSearchValue: ''
};

describe('FuzzySearchModal', () => {
  beforeEach(() => {
    // Reset mocks
    mockSmartValueSearch.mockReturnValue(createMockSearchResults());
    mockGetRecentSearchSuggestions.mockReturnValue(['recent1', 'recent2']);
    mockSanitizeInput.mockImplementation((input, options) => {
      if (typeof input !== 'string') return '';
      return input.trim().slice(0, options?.maxLength || 100);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders modal when open', () => {
      render(<FuzzySearchModal {...defaultProps} />);

      expect(screen.getByTestId('fuzzy-search-modal')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('search-tabs')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<FuzzySearchModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('fuzzy-search-modal')).not.toBeInTheDocument();
    });

    it('renders with initial search value', () => {
      render(<FuzzySearchModal {...defaultProps} initialSearchValue="150" />);

      const searchInput = screen.getByTestId('search-input') as HTMLInputElement;
      expect(searchInput.value).toBe('150');
    });

    it('renders search tabs', () => {
      render(<FuzzySearchModal {...defaultProps} />);

      expect(screen.getByTestId('exact-tab')).toBeInTheDocument();
      expect(screen.getByTestId('close-tab')).toBeInTheDocument();
      expect(screen.getByTestId('fuzzy-tab')).toBeInTheDocument();
    });

    it('shows loading state during search', async () => {
      // Mock slow search
      mockSmartValueSearch.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(createMockSearchResults()), 100);
        });
      });

      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, 'test');

      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('performs search when typing', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        expect(mockSmartValueSearch).toHaveBeenCalledWith(
          '150',
          defaultProps.data,
          defaultProps.transferredIds
        );
      });
    });

    it('sanitizes search input before processing', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '<script>alert("xss")</script>');

      await waitFor(() => {
        expect(mockSanitizeInput).toHaveBeenCalledWith(
          '<script>alert("xss")</script>',
          {
            type: 'text',
            maxLength: 100,
            strictMode: true
          }
        );
      });
    });

    it('saves search to recent searches', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        expect(mockSaveRecentSearch).toHaveBeenCalledWith('150');
      });
    });

    it('does not search for empty input', () => {
      render(<FuzzySearchModal {...defaultProps} />);

      expect(mockSmartValueSearch).not.toHaveBeenCalled();
    });

    it('displays search results in appropriate tabs', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        // Should show results in exact matches tab (default)
        expect(screen.getByText('Exact match')).toBeInTheDocument();
      });

      // Switch to close matches tab
      await userEvent.click(screen.getByTestId('close-tab'));
      expect(screen.getByText('Close match')).toBeInTheDocument();

      // Switch to fuzzy matches tab
      await userEvent.click(screen.getByTestId('fuzzy-tab'));
      expect(screen.getByText('Fuzzy match')).toBeInTheDocument();
    });
  });

  describe('Result Selection', () => {
    it('calls onSelect when result is clicked', async () => {
      const mockOnSelect = vi.fn();
      render(<FuzzySearchModal {...defaultProps} onSelect={mockOnSelect} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        const resultItem = screen.getByTestId('result-item-0');
        expect(resultItem).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-result-0');
      await userEvent.click(selectButton);

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({ originalHistory: 'Exact match' }),
          score: 1.0,
          type: 'exact'
        })
      );
    });

    it('closes modal after selection', async () => {
      const mockOnClose = vi.fn();
      render(<FuzzySearchModal {...defaultProps} onClose={mockOnClose} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        const selectButton = screen.getByTestId('select-result-0');
        userEvent.click(selectButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows result details with score and type', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        const resultItem = screen.getByTestId('result-item-0');
        expect(resultItem).toHaveTextContent('Score: 100%');
        expect(resultItem).toHaveTextContent('Exact match');
      });
    });
  });

  describe('Recent Searches', () => {
    it('displays recent search suggestions', () => {
      render(<FuzzySearchModal {...defaultProps} />);

      expect(screen.getByTestId('recent-searches')).toBeInTheDocument();
      expect(screen.getByText('recent1')).toBeInTheDocument();
      expect(screen.getByText('recent2')).toBeInTheDocument();
    });

    it('fills search input when recent search is clicked', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const recentSearch = screen.getByTestId('recent-search-0');
      await userEvent.click(recentSearch);

      const searchInput = screen.getByTestId('search-input') as HTMLInputElement;
      expect(searchInput.value).toBe('recent1');
    });

    it('triggers search when recent search is selected', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const recentSearch = screen.getByTestId('recent-search-0');
      await userEvent.click(recentSearch);

      await waitFor(() => {
        expect(mockSmartValueSearch).toHaveBeenCalledWith(
          'recent1',
          defaultProps.data,
          defaultProps.transferredIds
        );
      });
    });
  });

  describe('Tab Navigation', () => {
    it('switches between result tabs', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      // Default to exact tab
      expect(screen.getByTestId('exact-tab')).toHaveAttribute('aria-selected', 'true');

      // Switch to close tab
      await userEvent.click(screen.getByTestId('close-tab'));
      expect(screen.getByTestId('close-tab')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('exact-tab')).toHaveAttribute('aria-selected', 'false');

      // Switch to fuzzy tab
      await userEvent.click(screen.getByTestId('fuzzy-tab'));
      expect(screen.getByTestId('fuzzy-tab')).toHaveAttribute('aria-selected', 'true');
    });

    it('shows result counts in tab labels', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        expect(screen.getByTestId('exact-tab')).toHaveTextContent('Exatas (1)');
        expect(screen.getByTestId('close-tab')).toHaveTextContent('Próximas (1)');
        expect(screen.getByTestId('fuzzy-tab')).toHaveTextContent('Aproximadas (1)');
      });
    });
  });

  describe('Modal Controls', () => {
    it('closes modal when close button is clicked', async () => {
      const mockOnClose = vi.fn();
      render(<FuzzySearchModal {...defaultProps} onClose={mockOnClose} />);

      const closeButton = screen.getByTestId('close-modal');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when escape key is pressed', async () => {
      const mockOnClose = vi.fn();
      render(<FuzzySearchModal {...defaultProps} onClose={mockOnClose} />);

      await userEvent.keyboard('{Escape}');

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when backdrop is clicked', async () => {
      const mockOnClose = vi.fn();
      render(<FuzzySearchModal {...defaultProps} onClose={mockOnClose} />);

      const backdrop = screen.getByTestId('modal-backdrop');
      await userEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation in results', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        expect(screen.getByTestId('result-item-0')).toBeInTheDocument();
      });

      // Arrow down to select first result
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('result-item-0')).toHaveClass('highlighted');

      // Enter to select
      await userEvent.keyboard('{Enter}');
      expect(defaultProps.onSelect).toHaveBeenCalled();
    });

    it('supports tab navigation between search input and results', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        expect(screen.getByTestId('result-item-0')).toBeInTheDocument();
      });

      expect(searchInput).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('select-result-0')).toHaveFocus();
    });
  });

  describe('No Results State', () => {
    it('shows no results message when search yields nothing', async () => {
      mockSmartValueSearch.mockReturnValue({
        exactMatches: [],
        closeMatches: [],
        fuzzyMatches: [],
        suggestions: []
      });

      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
        expect(screen.getByText('Nenhum resultado encontrado')).toBeInTheDocument();
      });
    });

    it('shows suggestions when no exact matches found', async () => {
      mockSmartValueSearch.mockReturnValue({
        exactMatches: [],
        closeMatches: [],
        fuzzyMatches: [],
        suggestions: ['150', '151', '152']
      });

      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '149');

      await waitFor(() => {
        expect(screen.getByTestId('search-suggestions')).toBeInTheDocument();
        expect(screen.getByText('Talvez você quis dizer:')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const modal = screen.getByTestId('fuzzy-search-modal');
      const searchInput = screen.getByTestId('search-input');

      expect(modal).toHaveAttribute('role', 'dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(searchInput).toHaveAttribute('aria-label', 'Buscar valores');
    });

    it('manages focus properly', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      // Focus should be on search input when modal opens
      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toHaveFocus();
      });
    });

    it('announces search results to screen readers', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        const resultsRegion = screen.getByTestId('search-results');
        expect(resultsRegion).toHaveAttribute('aria-live', 'polite');
        expect(resultsRegion).toHaveAttribute('aria-label', '1 resultado encontrado');
      });
    });
  });

  describe('Performance', () => {
    it('debounces search input to avoid excessive API calls', async () => {
      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      // Type quickly
      await userEvent.type(searchInput, '1');
      await userEvent.type(searchInput, '5');
      await userEvent.type(searchInput, '0');

      // Should only call search once after debounce
      await waitFor(() => {
        expect(mockSmartValueSearch).toHaveBeenCalledTimes(1);
        expect(mockSmartValueSearch).toHaveBeenLastCalledWith(
          '150',
          defaultProps.data,
          defaultProps.transferredIds
        );
      });
    });

    it('cancels previous search when new search is initiated', async () => {
      let searchResolve: (value: any) => void;
      const searchPromise = new Promise(resolve => { searchResolve = resolve; });

      mockSmartValueSearch.mockReturnValue(searchPromise);

      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');

      // Start first search
      await userEvent.type(searchInput, '150');

      // Start second search before first completes
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, '200');

      // Complete first search
      searchResolve!(createMockSearchResults());

      // Should not show results from cancelled search
      await waitFor(() => {
        expect(screen.queryByText('Exact match')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles search errors gracefully', async () => {
      mockSmartValueSearch.mockImplementation(() => {
        throw new Error('Search failed');
      });

      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      await waitFor(() => {
        expect(screen.getByTestId('search-error')).toBeInTheDocument();
        expect(screen.getByText('Erro na busca')).toBeInTheDocument();
      });
    });

    it('handles malformed search data gracefully', async () => {
      mockSmartValueSearch.mockReturnValue({
        exactMatches: [{ item: null, score: NaN, type: 'exact' }],
        closeMatches: [],
        fuzzyMatches: [],
        suggestions: []
      });

      render(<FuzzySearchModal {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      await userEvent.type(searchInput, '150');

      // Should not crash and show appropriate message
      await waitFor(() => {
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
      });
    });
  });
});