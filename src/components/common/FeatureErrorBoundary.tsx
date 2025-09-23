import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../../utils/logger';

interface Props {
  feature: string;
  children: ReactNode;
  fallback?: React.ComponentType<{error: Error, retry: () => void, feature: string}>;
  onError?: (error: Error, errorInfo: ErrorInfo, feature: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId: string;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: `${props.feature}_${Date.now()}`
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { feature, onError } = this.props;

    logger.error(`[${feature}] Error boundary caught:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      feature,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString()
    });

    // Call custom error handler if provided
    onError?.(error, errorInfo, feature);

    // Report to monitoring service if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.withScope((scope: any) => {
        scope.setTag('errorBoundary', feature);
        scope.setContext('errorInfo', errorInfo);
        (window as any).Sentry.captureException(error);
      });
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorId: `${this.props.feature}_${Date.now()}`
    });
  };

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || DefaultErrorFallback;
      return (
        <Fallback
          error={this.state.error!}
          retry={this.retry}
          feature={this.props.feature}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{
  error: Error;
  retry: () => void;
  feature: string;
}> = ({ error, retry, feature }) => (
  <div className="bg-red-900/20 border border-red-400 rounded-lg p-6 m-4">
    <div className="flex items-start">
      <svg className="h-6 w-6 text-red-400 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="flex-1">
        <h3 className="text-lg font-medium text-red-400 mb-2">
          Erro em {feature}
        </h3>
        <p className="text-red-300 text-sm mb-4">
          Ocorreu um erro inesperado neste componente. Você pode tentar novamente ou recarregar a página.
        </p>

        {import.meta.env.MODE === 'development' && (
          <details className="mb-4 bg-red-950 rounded p-3">
            <summary className="text-red-200 cursor-pointer text-sm font-medium">
              Detalhes técnicos (Desenvolvimento)
            </summary>
            <pre className="text-xs text-red-200 mt-2 whitespace-pre-wrap">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex space-x-3">
          <button
            onClick={retry}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Tentar Novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-red-200 border border-red-400 rounded hover:bg-red-900/30 transition-colors"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    </div>
  </div>
);

export { DefaultErrorFallback };