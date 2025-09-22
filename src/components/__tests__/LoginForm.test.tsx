/**
 * Comprehensive unit tests for LoginForm component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LoginForm } from '../LoginForm';
import { AuthContext } from '../../contexts/AuthContext';
import { createUser } from '../../test/factories/advanced-factories';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock sanitization
vi.mock('../../utils/input-sanitization', () => ({
  sanitizeInput: vi.fn((input, options) => {
    // Simple mock that returns cleaned input
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, options?.maxLength || 1000);
  })
}));

// Mock auth context values
const createMockAuthContext = (overrides = {}) => ({
  user: null,
  isLoading: false,
  loginError: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearLoginError: vi.fn(),
  checkAuth: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides
});

// Test wrapper component
const TestWrapper = ({
  children,
  authValue = createMockAuthContext()
}: {
  children: React.ReactNode;
  authValue?: any;
}) => (
  <BrowserRouter>
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  </BrowserRouter>
);

describe('LoginForm', () => {
  let mockAuthContext: ReturnType<typeof createMockAuthContext>;

  beforeEach(() => {
    mockAuthContext = createMockAuthContext();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders login form with all required elements', () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByTestId('username-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-button')).toBeInTheDocument();
      expect(screen.getByText('Manipularium')).toBeInTheDocument();
      expect(screen.getByText('Conferência Bancária - Acesso Restrito')).toBeInTheDocument();
    });

    it('renders logo image with correct attributes', () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const logo = screen.getByAltText('Manipularium Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src');
      expect(logo).toHaveClass('h-24', 'w-24', 'mx-auto', 'drop-shadow-lg');
    });

    it('displays login error when present', () => {
      const contextWithError = createMockAuthContext({
        loginError: 'Usuário ou senha incorretos'
      });

      render(
        <TestWrapper authValue={contextWithError}>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByTestId('login-error')).toBeInTheDocument();
      expect(screen.getByText('Usuário ou senha incorretos')).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
      const contextWithLoading = createMockAuthContext({
        isLoading: true
      });

      render(
        <TestWrapper authValue={contextWithLoading}>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByTestId('login-button')).toBeDisabled();
      expect(screen.getByText('Entrando...')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('login-button');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toBeInTheDocument();
        expect(screen.getByTestId('password-error')).toBeInTheDocument();
      });
    });

    it('validates minimum username length', async () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      await userEvent.type(usernameInput, 'ab');
      await userEvent.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toHaveTextContent('muito curto');
      });
    });

    it('validates minimum password length', async () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const passwordInput = screen.getByTestId('password-input');
      await userEvent.type(passwordInput, '123');
      await userEvent.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByTestId('password-error')).toHaveTextContent('muito curta');
      });
    });

    it('clears validation errors when fields become valid', async () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');

      // Trigger validation errors
      await userEvent.click(screen.getByTestId('login-button'));

      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toBeInTheDocument();
        expect(screen.getByTestId('password-error')).toBeInTheDocument();
      });

      // Fix the errors
      await userEvent.type(usernameInput, 'validuser');
      await userEvent.type(passwordInput, 'validpassword');

      await waitFor(() => {
        expect(screen.queryByTestId('username-error')).not.toBeInTheDocument();
        expect(screen.queryByTestId('password-error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls login with sanitized credentials on valid submission', async () => {
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'testpassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpassword');
      });
    });

    it('navigates to dashboard on successful login', async () => {
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'testpassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('does not navigate on failed login', async () => {
      const mockLogin = vi.fn().mockResolvedValue(false);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'wrongpassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('clears login error before submission', async () => {
      const mockClearError = vi.fn();
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMocks = createMockAuthContext({
        login: mockLogin,
        clearLoginError: mockClearError,
        loginError: 'Previous error'
      });

      render(
        <TestWrapper authValue={contextWithMocks}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'testpassword');
      await userEvent.click(submitButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Input Sanitization', () => {
    it('sanitizes username input before submission', async () => {
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      // Input with potential XSS
      await userEvent.type(usernameInput, '  <script>alert("xss")</script>  ');
      await userEvent.type(passwordInput, 'testpassword');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          '<script>alert("xss")</script>', // Sanitized (trimmed)
          'testpassword'
        );
      });
    });

    it('handles empty sanitized input gracefully', async () => {
      const mockLogin = vi.fn();
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      // Mock sanitizeInput to return empty string
      vi.mocked(vi.importActual('../../utils/input-sanitization')).sanitizeInput = vi.fn(() => '');

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'sometext');
      await userEvent.type(passwordInput, 'somepassword');
      await userEvent.click(submitButton);

      // Should not call login if sanitization results in empty input
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and ARIA attributes', () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');

      expect(usernameInput).toHaveAttribute('aria-label', 'Nome de usuário');
      expect(passwordInput).toHaveAttribute('aria-label', 'Senha');
      expect(screen.getByTestId('login-form')).toHaveAttribute('role', 'form');
    });

    it('supports keyboard navigation', async () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      // Tab through form elements
      await userEvent.tab();
      expect(usernameInput).toHaveFocus();

      await userEvent.tab();
      expect(passwordInput).toHaveFocus();

      await userEvent.tab();
      expect(submitButton).toHaveFocus();
    });

    it('announces errors to screen readers', async () => {
      render(
        <TestWrapper authValue={mockAuthContext}>
          <LoginForm />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('login-button');
      await userEvent.click(submitButton);

      await waitFor(() => {
        const usernameError = screen.getByTestId('username-error');
        const passwordError = screen.getByTestId('password-error');

        expect(usernameError).toHaveAttribute('role', 'alert');
        expect(passwordError).toHaveAttribute('role', 'alert');
      });
    });
  });

  describe('Error States', () => {
    it('displays authentication errors from context', () => {
      const contextWithError = createMockAuthContext({
        loginError: 'Authentication failed'
      });

      render(
        <TestWrapper authValue={contextWithError}>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByTestId('login-error')).toHaveTextContent('Authentication failed');
    });

    it('clears error when user starts typing', async () => {
      const mockClearError = vi.fn();
      const contextWithError = createMockAuthContext({
        loginError: 'Authentication failed',
        clearLoginError: mockClearError
      });

      render(
        <TestWrapper authValue={contextWithError}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      await userEvent.type(usernameInput, 'a');

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Security', () => {
    it('does not log sensitive information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'secretpassword');
      await userEvent.click(submitButton);

      // Verify no password is logged
      const logs = consoleSpy.mock.calls.flat().join(' ');
      expect(logs).not.toContain('secretpassword');

      consoleSpy.mockRestore();
    });

    it('prevents form submission during loading', async () => {
      const mockLogin = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      const contextWithLoading = createMockAuthContext({
        login: mockLogin,
        isLoading: true
      });

      render(
        <TestWrapper authValue={contextWithLoading}>
          <LoginForm />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('login-button');
      expect(submitButton).toBeDisabled();

      await userEvent.click(submitButton);
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in input', async () => {
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'user@domain.com');
      await userEvent.type(passwordInput, 'p@ssw0rd!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('user@domain.com', 'p@ssw0rd!');
      });
    });

    it('handles very long input gracefully', async () => {
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      const longUsername = 'a'.repeat(200);
      const longPassword = 'b'.repeat(300);

      await userEvent.type(usernameInput, longUsername);
      await userEvent.type(passwordInput, longPassword);
      await userEvent.click(submitButton);

      await waitFor(() => {
        // Should be truncated by sanitization
        const [username, password] = mockLogin.mock.calls[0];
        expect(username.length).toBeLessThanOrEqual(100);
        expect(password.length).toBeLessThanOrEqual(200);
      });
    });

    it('handles rapid form submissions', async () => {
      const mockLogin = vi.fn().mockResolvedValue(true);
      const contextWithMockLogin = createMockAuthContext({
        login: mockLogin
      });

      render(
        <TestWrapper authValue={contextWithMockLogin}>
          <LoginForm />
        </TestWrapper>
      );

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('login-button');

      await userEvent.type(usernameInput, 'testuser');
      await userEvent.type(passwordInput, 'testpassword');

      // Rapid submissions
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);

      // Should only call login once due to loading state
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });
  });
});