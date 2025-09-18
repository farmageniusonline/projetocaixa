import React, { useState, useEffect } from 'react';
import { performanceLogger, PerformanceStats, OperationType } from '../utils/performanceLogger';

interface DevPerformancePanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

const OPERATION_LABELS: Record<OperationType, string> = {
  excel_parse: 'Parse Excel',
  excel_filter: 'Filtro Excel',
  conference_search: 'Busca Conferência',
  conference_transfer: 'Transferência',
  manual_entry_save: 'Salvar Manual',
  data_export: 'Export Dados',
  cache_operations: 'Cache Ops'
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

export const DevPerformancePanel: React.FC<DevPerformancePanelProps> = ({ isVisible, onToggle }) => {
  const [stats, setStats] = useState<PerformanceStats[]>([]);
  const [isEnabled, setIsEnabled] = useState(performanceLogger.isLoggingEnabled());
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible && isEnabled) {
      loadStats();
    }
  }, [isVisible, isEnabled, refreshKey]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const todaysStats = await performanceLogger.getTodaysStats();
      setStats(todaysStats);
    } catch (error) {
      console.error('Failed to load performance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLogging = () => {
    const newEnabled = !isEnabled;
    performanceLogger.setEnabled(newEnabled);
    setIsEnabled(newEnabled);
    if (newEnabled) {
      loadStats();
    } else {
      setStats([]);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleClearMetrics = async () => {
    if (confirm('Limpar todas as métricas de performance?')) {
      await performanceLogger.clearAllMetrics();
      setStats([]);
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleExportMetrics = async () => {
    try {
      const metrics = await performanceLogger.exportMetrics();
      const dataStr = JSON.stringify(metrics, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `performance-metrics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export metrics:', error);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors"
        title="Abrir painel de performance"
      >
        📊 Perf
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-100 flex items-center">
          📊 Performance Monitor
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleToggleLogging}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              isEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            title={isEnabled ? 'Desabilitar logging' : 'Habilitar logging'}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={onToggle}
            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Fechar painel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {!isEnabled ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400 mb-2">
              Performance logging está desabilitado
            </p>
            <button
              onClick={handleToggleLogging}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Habilitar
            </button>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex items-center space-x-2 mb-3">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '⟳' : '🔄'} Refresh
              </button>
              <button
                onClick={handleClearMetrics}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                🗑️ Limpar
              </button>
              <button
                onClick={handleExportMetrics}
                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                💾 Export
              </button>
            </div>

            {/* Stats */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">Carregando estatísticas...</p>
                </div>
              ) : stats.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400">
                    Nenhuma métrica registrada hoje
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-1 text-xs text-gray-400 font-semibold border-b border-gray-700 pb-1">
                    <span>Operação</span>
                    <span className="text-center">Count</span>
                    <span className="text-right">Avg</span>
                    <span className="text-right">P95</span>
                    <span className="text-right">Max</span>
                  </div>

                  {stats.map((stat) => (
                    <div
                      key={stat.operation}
                      className="grid grid-cols-5 gap-1 text-xs text-gray-300 py-1 hover:bg-gray-800 rounded px-1"
                    >
                      <span className="truncate" title={OPERATION_LABELS[stat.operation]}>
                        {OPERATION_LABELS[stat.operation]}
                      </span>
                      <span className="text-center text-gray-400">
                        {stat.count}
                      </span>
                      <span className="text-right font-mono">
                        {formatDuration(stat.average)}
                      </span>
                      <span className="text-right font-mono text-yellow-400">
                        {formatDuration(stat.p95)}
                      </span>
                      <span className="text-right font-mono text-red-400">
                        {formatDuration(stat.max)}
                      </span>
                    </div>
                  ))}

                  {/* Summary */}
                  <div className="pt-2 mt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400">
                      <p>Total operations: {stats.reduce((sum, s) => sum + s.count, 0)}</p>
                      <p>Total time: {formatDuration(stats.reduce((sum, s) => sum + s.totalTime, 0))}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Performance Tips */}
      {isEnabled && stats.length > 0 && (
        <div className="p-2 border-t border-gray-700 bg-gray-800">
          {(() => {
            const slowestOp = stats[0];
            if (slowestOp?.p95 > 1000) {
              return (
                <div className="text-xs text-yellow-400">
                  ⚠️ {OPERATION_LABELS[slowestOp.operation]} está lento (P95: {formatDuration(slowestOp.p95)})
                </div>
              );
            }

            const totalOps = stats.reduce((sum, s) => sum + s.count, 0);
            if (totalOps > 100) {
              return (
                <div className="text-xs text-blue-400">
                  ✓ {totalOps} operações monitoradas hoje
                </div>
              );
            }

            return (
              <div className="text-xs text-gray-400">
                📊 Coletando dados de performance...
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};