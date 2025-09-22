import React, { Component, ReactNode } from 'react';
import { logger } from '../../utils/logger';
import type { AppError } from '../../types';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  feature: string;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
  enableRetry?: boolean;
  resetOnPropsChange?: boolean;
  resetKeys?: unknown[];
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  retry: () => void;
  feature: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  retry,
  feature,
  retryCount,
  maxRetries,
  canRetry
}) => (
  <div className="min-h-[200px] flex items-center justify-center p-6">
    <div className="max-w-md w-full bg-red-900/20 border border-red-400 rounded-lg p-6 text-center">
      <div className="text-red-400 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-red-300 mb-2">
        Erro no {feature}
      </h3>

      <p className="text-gray-300 text-sm mb-4">
        {error.message || 'Ocorreu um erro inesperado'}
      </p>

      {retryCount > 0 && (
        <p className="text-yellow-300 text-xs mb-3">
          Tentativa {retryCount} de {maxRetries}
        </p>
      )}

      <div className="space-y-2">
        {canRetry && (
          <button
            onClick={retry}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Tentar Novamente
          </button>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-gray-100 rounded-md text-sm font-medium transition-colors"
        >
          Recarregar Página
        </button>
      </div>

      <details className="mt-4 text-left">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
          Detalhes técnicos
        </summary>
        <pre className="mt-2 text-xs text-gray-500 bg-gray-800 p-2 rounded overflow-x-auto">
          {error.stack}
        </pre>
      </details>
    </div>
  </div>
);

export class FeatureErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { feature, onError } = this.props;

    // Create structured error object
    const appError: AppError = {
      code: 'REACT_ERROR_BOUNDARY',
      message: error.message,
      details: {
        feature,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name
      },
      timestamp: new Date()
    };

    // Log error with context
    logger.error(`Error boundary caught error in ${feature}`, {
      error: appError,
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Call custom error handler
    onError?.(error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // Report to external error tracking service
    this.reportError(appError);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetOnPropsChange && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const hasResetKeyChanged = resetKeys.some((key, idx) => key !== prevResetKeys[idx]);

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private reportError = (error: AppError) => {
    // In a real app, you would send this to your error tracking service
    // Example: Sentry, LogRocket, Bugsnag, etc.

    if (import.meta.env.PROD) {
      // Only report in production
      // window.gtag?.('event', 'exception', {
      //   description: error.message,
      //   fatal: false
      // });
    }
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0
    });
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      logger.info(`Retrying ${this.props.feature}`, {
        attempt: retryCount + 1,
        maxRetries
      });

      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
      });

      // Auto-reset retry count after successful render
      this.resetTimeoutId = window.setTimeout(() => {
        this.setState({ retryCount: 0 });
      }, 30000); // Reset after 30 seconds
    }
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const {
      children,
      feature,
      fallback: Fallback = DefaultErrorFallback,
      maxRetries = 3,
      enableRetry = true
    } = this.props;

    if (hasError && error) {
      const canRetry = enableRetry && retryCount < maxRetries;

      return (
        <Fallback
          error={error}
          errorInfo={errorInfo}
          retry={this.handleRetry}
          feature={feature}
          retryCount={retryCount}
          maxRetries={maxRetries}
          canRetry={canRetry}
        />
      );
    }

    return children;
  }
}

// Specialized Error Boundaries for different features
export const FileUploadErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary
    feature="Upload de Arquivos"
    maxRetries={2}
    resetOnPropsChange={true}
  >
    {children}
  </FeatureErrorBoundary>
);

export const DataTableErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary
    feature="Tabela de Dados"
    maxRetries={1}
    enableRetry={true}
  >
    {children}
  </FeatureErrorBoundary>
);

export const ExcelProcessingErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary
    feature="Processamento Excel"
    maxRetries={3}
    resetOnPropsChange={true}
  >
    {children}
  </FeatureErrorBoundary>
);

export const AuthenticationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary
    feature="Autenticação"
    maxRetries={1}
    enableRetry={false}
    onError={(error) => {
      // Special handling for auth errors
      if (error.message.includes('auth') || error.message.includes('login')) {
        // Clear auth data and redirect to login
        localStorage.removeItem('auth_user');
        window.location.href = '/';
      }
    }}
  >
    {children}
  </FeatureErrorBoundary>
);

export const DatabaseErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <FeatureErrorBoundary
    feature="Banco de Dados"
    maxRetries={2}
    enableRetry={true}
  >
    {children}
  </FeatureErrorBoundary>
);

// HOC for wrapping components with error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  feature: string,
  options?: Partial<ErrorBoundaryProps>
) {
  const WrappedComponent = (props: P) => (
    <FeatureErrorBoundary feature={feature} {...options}>
      <Component {...props} />
    </FeatureErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for programmatically triggering error boundaries
export function useErrorHandler() {
  return (error: Error, errorInfo?: { [key: string]: unknown }) => {
    logger.error('Manual error thrown', { error, errorInfo });
    throw error;
  };
}