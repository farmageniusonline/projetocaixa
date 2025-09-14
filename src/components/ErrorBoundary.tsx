import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorage = () => {
    localStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-2xl w-full">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h1 className="text-xl font-semibold text-gray-100 mb-2">
                  Erro na Aplicação
                </h1>
                <p className="text-sm text-gray-300 mb-4">
                  Ocorreu um erro inesperado. Isso pode ser causado por dados corrompidos no armazenamento local ou um problema na aplicação.
                </p>

                {process.env.NODE_ENV === 'development' && (
                  <details className="mb-4 bg-gray-900 rounded p-3">
                    <summary className="text-sm font-medium text-gray-200 cursor-pointer">
                      Detalhes do Erro (Desenvolvimento)
                    </summary>
                    <div className="mt-2 text-xs text-red-300 font-mono whitespace-pre-wrap">
                      <div className="mb-2">
                        <strong>Erro:</strong> {this.state.error?.toString()}
                      </div>
                      <div>
                        <strong>Stack:</strong> {this.state.error?.stack}
                      </div>
                      {this.state.errorInfo && (
                        <div className="mt-2">
                          <strong>Component Stack:</strong>
                          {this.state.errorInfo.componentStack}
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={this.handleReload}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors"
                  >
                    Recarregar Página
                  </button>
                  <button
                    onClick={this.handleClearStorage}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors"
                  >
                    Limpar Dados e Recarregar
                  </button>
                </div>

                <p className="mt-3 text-xs text-gray-400">
                  Se o problema persistir, entre em contato com o suporte técnico.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}