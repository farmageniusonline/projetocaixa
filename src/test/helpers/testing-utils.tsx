/**
 * Testing utilities and helpers for consistent test setup
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { createMockUser } from '../factories';
import type { User } from '../../types';

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  user?: User | null;
  withAuth?: boolean;
  withRouter?: boolean;
}

function AllTheProviders({
  children,
  user = null,
  initialRoute = '/'
}: {
  children: React.ReactNode;
  user?: User | null;
  initialRoute?: string;
}) {
  // Mock AuthContext value
  const mockAuthValue = {
    user,
    isLoading: false,
    loginError: '',
    login: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
    clearLoginError: vi.fn()
  };

  return (
    <BrowserRouter>
      <AuthProvider value={mockAuthValue}>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    initialRoute = '/',
    user = createMockUser(),
    withAuth = true,
    withRouter = true,
    ...renderOptions
  } = options;

  // Set initial route
  if (withRouter && initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    if (withAuth && withRouter) {
      return (
        <AllTheProviders user={user} initialRoute={initialRoute}>
          {children}
        </AllTheProviders>
      );
    }

    if (withRouter) {
      return <BrowserRouter>{children}</BrowserRouter>;
    }

    if (withAuth) {
      return (
        <AuthProvider value={{
          user,
          isLoading: false,
          loginError: '',
          login: vi.fn().mockResolvedValue(true),
          logout: vi.fn().mockResolvedValue(undefined),
          clearLoginError: vi.fn()
        }}>
          {children}
        </AuthProvider>
      );
    }

    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };

// Custom user event setup
export function setupUserEvent() {
  return userEvent.setup();
}

// Common test utilities
export const testUtils = {
  // Wait for element to appear
  async waitForElement(text: string | RegExp, options?: any) {
    return await screen.findByText(text, options);
  },

  // Wait for element to disappear
  async waitForElementToDisappear(text: string | RegExp) {
    await waitFor(() => {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    });
  },

  // Simulate file upload
  async uploadFile(input: HTMLElement, file: File) {
    const user = setupUserEvent();
    await user.upload(input, file);
  },

  // Simulate form submission
  async submitForm(form: HTMLElement) {
    const user = setupUserEvent();
    await user.click(screen.getByRole('button', { name: /submit|enviar|salvar/i }));
  },

  // Wait for loading to complete
  async waitForLoadingToComplete() {
    await waitFor(() => {
      expect(screen.queryByText(/carregando|loading/i)).not.toBeInTheDocument();
    });
  },

  // Check for error messages
  expectErrorMessage(message: string | RegExp) {
    expect(screen.getByText(message)).toBeInTheDocument();
  },

  // Check for success messages
  expectSuccessMessage(message: string | RegExp) {
    expect(screen.getByText(message)).toBeInTheDocument();
  },

  // Mock console methods
  mockConsole() {
    const originalConsole = { ...console };

    beforeEach(() => {
      console.log = vi.fn();
      console.warn = vi.fn();
      console.error = vi.fn();
      console.debug = vi.fn();
    });

    afterEach(() => {
      Object.assign(console, originalConsole);
    });
  },

  // Mock window methods
  mockWindow() {
    const originalWindow = { ...window };

    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000',
          pathname: '/',
          search: '',
          hash: '',
          reload: vi.fn()
        },
        writable: true
      });

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn()
        },
        writable: true
      });
    });

    afterEach(() => {
      Object.assign(window, originalWindow);
    });
  },

  // Mock fetch API
  mockFetch() {
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
    });

    afterEach(() => {
      mockFetch.mockRestore();
    });

    return mockFetch;
  }
};

// Custom matchers
export const customMatchers = {
  // Check if element has specific class
  toHaveClass(element: HTMLElement, className: string) {
    return {
      pass: element.classList.contains(className),
      message: () => `Expected element to have class "${className}"`
    };
  },

  // Check if element is visible
  toBeVisible(element: HTMLElement) {
    const isVisible = element.offsetWidth > 0 && element.offsetHeight > 0;
    return {
      pass: isVisible,
      message: () => `Expected element to be visible`
    };
  }
};

// Test wrapper for async operations
export function createAsyncWrapper() {
  const errors: Error[] = [];

  const wrapper = {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      try {
        return await fn();
      } catch (error) {
        errors.push(error as Error);
        throw error;
      }
    },

    getErrors(): Error[] {
      return [...errors];
    },

    clearErrors(): void {
      errors.length = 0;
    }
  };

  return wrapper;
}

// Performance testing helpers
export const performanceUtils = {
  // Measure component render time
  async measureRenderTime(component: () => ReactElement): Promise<number> {
    const start = performance.now();
    render(component());
    await waitFor(() => {}); // Wait for render
    return performance.now() - start;
  },

  // Memory usage tracker
  getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  },

  // Wait for idle callback
  async waitForIdle(): Promise<void> {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
};

// Mock data utilities
export const mockUtils = {
  // Create mock localStorage
  createMockLocalStorage() {
    const store: Record<string, string> = {};

    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      })
    };
  },

  // Create mock IndexedDB
  createMockIndexedDB() {
    const stores: Record<string, any[]> = {};

    return {
      get: vi.fn((store: string, key: string) => {
        const items = stores[store] || [];
        return items.find(item => item.id === key);
      }),
      getAll: vi.fn((store: string) => stores[store] || []),
      add: vi.fn((store: string, item: any) => {
        if (!stores[store]) stores[store] = [];
        stores[store].push(item);
      }),
      put: vi.fn((store: string, item: any) => {
        if (!stores[store]) stores[store] = [];
        const index = stores[store].findIndex(existing => existing.id === item.id);
        if (index >= 0) {
          stores[store][index] = item;
        } else {
          stores[store].push(item);
        }
      }),
      delete: vi.fn((store: string, key: string) => {
        if (stores[store]) {
          stores[store] = stores[store].filter(item => item.id !== key);
        }
      }),
      clear: vi.fn((store: string) => {
        stores[store] = [];
      })
    };
  },

  // Create mock Supabase client
  createMockSupabase() {
    const mockResponse = { data: null, error: null };

    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockResponse))
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockResponse))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockResponse))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(mockResponse))
            }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve(mockResponse))
        }))
      })),
      auth: {
        signInWithPassword: vi.fn(() => Promise.resolve(mockResponse)),
        signOut: vi.fn(() => Promise.resolve(mockResponse)),
        getSession: vi.fn(() => Promise.resolve(mockResponse))
      }
    };
  }
};

// Accessibility testing helpers
export const a11yUtils = {
  // Check for accessibility violations
  async checkA11y(container: HTMLElement) {
    // This would integrate with @axe-core/react in a real implementation
    const violations = [];

    // Basic checks
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      if (!img.alt) {
        violations.push('Image missing alt text');
      }
    });

    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      if (!button.textContent && !button.getAttribute('aria-label')) {
        violations.push('Button missing accessible name');
      }
    });

    return violations;
  },

  // Check keyboard navigation
  async testKeyboardNavigation(container: HTMLElement) {
    const user = setupUserEvent();
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    let currentIndex = 0;
    for (const element of focusableElements) {
      await user.tab();
      expect(document.activeElement).toBe(element);
      currentIndex++;
    }

    return currentIndex;
  }
};