import React, { useState, useEffect } from 'react';
import { performanceLogger, PerformanceStats } from '../utils/performanceLogger';
import { logger } from '../utils/logger';

interface MetricsDashboardProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  isVisible,
  onToggle
}) => {
  const [stats, setStats] = useState<PerformanceStats[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsEnabled(performanceLogger.isLoggingEnabled());
    if (isVisible && performanceLogger.isLoggingEnabled()) {
      loadStats();
    }
  }, [isVisible]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const todayStats = await performanceLogger.getTodaysStats();
      setStats(todayStats);
    } catch (error) {
      logger.error('Error loading performance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePerformanceLogging = () => {
    const newEnabled = !isEnabled;
    performanceLogger.setEnabled(newEnabled);
    setIsEnabled(newEnabled);

    if (newEnabled) {
      loadStats();
    } else {
      setStats([]);
    }
  };

  const clearMetrics = async () => {
    if (confirm('Tem certeza que deseja limpar todas as métricas?')) {
      try {
        await performanceLogger.clearAllMetrics();
        setStats([]);
        logger.info('Performance metrics cleared');
      } catch (error) {
        logger.error('Error clearing metrics:', error);
      }
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getOperationColor = (operation: string) => {
    const colors: Record<string, string> = {
      excel_parse: 'text-blue-400',
      excel_filter: 'text-cyan-400',
      conference_search: 'text-green-400',
      conference_transfer: 'text-purple-400',
      manual_entry_save: 'text-orange-400',
      data_export: 'text-indigo-400',
      cache_operations: 'text-teal-400'
    };
    return colors[operation] || 'text-gray-400';
  };

  const getOperationIcon = (operation: string) => {
    const icons: Record<string, string> = {
      excel_parse: '📊',
      excel_filter: '🔍',
      conference_search: '🔎',
      conference_transfer: '💸',
      manual_entry_save: '💾',
      data_export: '📤',
      cache_operations: '⚡'
    };
    return icons[operation] || '⚙️';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 right-4 w-96 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-50 max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">
            📊 Performance Metrics
          </h3>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            title="Fechar dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-2 mt-2">
          <button
            onClick={togglePerformanceLogging}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              isEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            title={isEnabled ? 'Desabilitar métricas' : 'Habilitar métricas'}
          >
            {isEnabled ? '🟢 Enabled' : '🔴 Disabled'}
          </button>

          {isEnabled && (
            <>
              <button
                onClick={loadStats}
                disabled={loading}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                title="Atualizar métricas"
              >
                {loading ? '⏳' : '🔄'} Refresh
              </button>

              <button
                onClick={clearMetrics}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="Limpar todas as métricas"
              >
                🗑️ Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        {!isEnabled ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-4">
              Performance logging está desabilitado
            </p>
            <p className="text-sm text-gray-500">
              Habilite para começar a coletar métricas de performance do sistema
            </p>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-8">
            <div className="mb-4">
              {loading ? (
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              ) : (
                <svg className="w-16 h-16 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              )}
            </div>
            <p className="text-gray-400 mb-2">
              {loading ? 'Carregando métricas...' : 'Nenhuma métrica disponível'}
            </p>
            <p className="text-sm text-gray-500">
              Use o sistema para gerar dados de performance
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-gray-400 mb-4 flex justify-between">
              <span>📈 Métricas de hoje</span>
              <span>{stats.length} operações</span>
            </div>

            {stats.map((stat, index) => (
              <div key={index} className="bg-gray-900 rounded p-3 border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getOperationIcon(stat.operation)}</span>
                    <h4 className={`font-medium ${getOperationColor(stat.operation)}`}>
                      {stat.operation.replace(/_/g, ' ').toUpperCase()}
                    </h4>
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                    {stat.count} ops
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Média:</span>
                    <span className="text-gray-200">
                      {formatDuration(stat.average)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">P95:</span>
                    <span className="text-yellow-400">
                      {formatDuration(stat.p95)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min:</span>
                    <span className="text-green-400">
                      {formatDuration(stat.min)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max:</span>
                    <span className="text-red-400">
                      {formatDuration(stat.max)}
                    </span>
                  </div>
                </div>

                {/* Performance bar */}
                <div className="relative">
                  <div className="bg-gray-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        stat.average < 100 ? 'bg-green-500' :
                        stat.average < 500 ? 'bg-yellow-500' :
                        stat.average < 1000 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (stat.average / stat.max) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Rápido</span>
                    <span>Lento</span>
                  </div>
                </div>

                {/* Total time */}
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Total: {formatDuration(stat.totalTime)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with tips */}
      {isEnabled && (
        <div className="border-t border-gray-700 p-3 bg-gray-900/50">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center space-x-1">
              <span>💡</span>
              <span>P95: 95% das operações são mais rápidas que este valor</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>🎯</span>
              <span>Verde (&lt;100ms), Amarelo (&lt;500ms), Laranja (&lt;1s), Vermelho (&gt;1s)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};