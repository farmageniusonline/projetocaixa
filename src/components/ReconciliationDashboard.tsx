import React, { useState, useEffect } from 'react';
import {
  reconciliationEngine,
  ReconciliationReport,
  ReconciliationMatch,
  ReconciliationSource,
  createReconciliationSource,
  exportReconciliationReport
} from '../utils/reconciliation';
import { ParsedRow } from '../utils/excelParser';

interface ReconciliationDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  bankData?: ParsedRow[];
  cashData?: ParsedRow[];
}

export const ReconciliationDashboard: React.FC<ReconciliationDashboardProps> = ({
  isOpen,
  onClose,
  bankData = [],
  cashData = []
}) => {
  const [isReconciling, setIsReconciling] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'matches' | 'conflicts' | 'unmatched'>('overview');
  const [selectedMatch, setSelectedMatch] = useState<ReconciliationMatch | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Clear previous data and add current sources
      reconciliationEngine.removeSource('bank_statement');
      reconciliationEngine.removeSource('cash_register');

      if (bankData.length > 0) {
        const bankSource = createReconciliationSource('bank_statement', 'Extrato Bancário', bankData);
        reconciliationEngine.addSource(bankSource);
      }

      if (cashData.length > 0) {
        const cashSource = createReconciliationSource('cash_register', 'Conferência de Caixa', cashData, 'cash_register');
        reconciliationEngine.addSource(cashSource);
      }
    }
  }, [isOpen, bankData, cashData]);

  const handleStartReconciliation = async () => {
    setIsReconciling(true);
    try {
      const result = await reconciliationEngine.reconcile();
      setReport(result);
    } catch (error) {
      console.error('Error during reconciliation:', error);
      alert('Erro durante a reconciliação. Verifique os dados e tente novamente.');
    } finally {
      setIsReconciling(false);
    }
  };

  const handleExportReport = () => {
    if (report) {
      exportReconciliationReport(report);
    }
  };

  const getMatchTypeColor = (type: ReconciliationMatch['matchType']): string => {
    switch (type) {
      case 'exact': return 'text-green-400';
      case 'approximate': return 'text-yellow-400';
      case 'pattern': return 'text-blue-400';
      case 'manual': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getMatchTypeLabel = (type: ReconciliationMatch['matchType']): string => {
    switch (type) {
      case 'exact': return 'Exato';
      case 'approximate': return 'Aproximado';
      case 'pattern': return 'Padrão';
      case 'manual': return 'Manual';
      default: return 'Desconhecido';
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-7xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-100">Reconciliação Automática</h3>
            <p className="text-sm text-gray-400">
              Compare automaticamente dados de diferentes fontes e identifique correspondências e discrepâncias
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!report ? (
          /* Initial Setup */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="mb-6">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h4 className="text-lg font-medium text-gray-300 mb-2">Reconciliação Automática</h4>
                <p className="text-gray-500">
                  Este sistema irá comparar automaticamente seus dados bancários com os dados de conferência de caixa,
                  identificando correspondências e possíveis discrepâncias.
                </p>
              </div>

              {/* Data Sources Status */}
              <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                <h5 className="text-sm font-medium text-gray-300 mb-3">Fontes de Dados</h5>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Dados Bancários:</span>
                    <span className={bankData.length > 0 ? 'text-green-400' : 'text-red-400'}>
                      {bankData.length > 0 ? `${bankData.length} registros` : 'Não carregado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Conferência de Caixa:</span>
                    <span className={cashData.length > 0 ? 'text-green-400' : 'text-red-400'}>
                      {cashData.length > 0 ? `${cashData.length} registros` : 'Não carregado'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartReconciliation}
                disabled={isReconciling || (bankData.length === 0 && cashData.length === 0)}
                className="px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center mx-auto"
              >
                {isReconciling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando Reconciliação...
                  </>
                ) : (
                  'Iniciar Reconciliação'
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Report View */
          <>
            {/* Tabs */}
            <div className="flex space-x-1 mb-6 border-b border-gray-700">
              <button
                onClick={() => setSelectedTab('overview')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  selectedTab === 'overview'
                    ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
                }`}
              >
                Resumo
              </button>
              <button
                onClick={() => setSelectedTab('matches')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  selectedTab === 'matches'
                    ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
                }`}
              >
                Correspondências ({report.matches.length})
              </button>
              <button
                onClick={() => setSelectedTab('conflicts')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  selectedTab === 'conflicts'
                    ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
                }`}
              >
                Conflitos ({report.summary.conflictingRecords})
              </button>
              <button
                onClick={() => setSelectedTab('unmatched')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  selectedTab === 'unmatched'
                    ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
                }`}
              >
                Não Correspondidos ({report.summary.unmatchedRecords})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {selectedTab === 'overview' && (
                <div>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-gray-100">{report.summary.totalRecords}</div>
                      <div className="text-sm text-gray-400">Total de Registros</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-400">{report.summary.matchedRecords}</div>
                      <div className="text-sm text-gray-400">Correspondidos</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {((report.summary.matchedRecords / report.summary.totalRecords) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-red-400">{report.summary.conflictingRecords}</div>
                      <div className="text-sm text-gray-400">Conflitos</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-gray-400">{report.summary.unmatchedRecords}</div>
                      <div className="text-sm text-gray-400">Não Correspondidos</div>
                    </div>
                  </div>

                  {/* Value Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-lg font-bold text-gray-100">
                        {report.summary.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-sm text-gray-400">Valor Total</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-lg font-bold text-green-400">
                        {report.summary.matchedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-sm text-gray-400">Valor Correspondido</div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-lg font-bold text-red-400">
                        {report.summary.unmatchedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-sm text-gray-400">Valor Não Correspondido</div>
                    </div>
                  </div>

                  {/* Confidence Distribution */}
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h5 className="text-sm font-medium text-gray-300 mb-3">Distribuição de Confiança</h5>
                    <div className="space-y-2">
                      {Object.entries(report.summary.confidenceDistribution).map(([level, count]) => (
                        <div key={level} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 capitalize">{level}:</span>
                          <span className="text-gray-200">{count} correspondências</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === 'matches' && (
                <div className="space-y-4">
                  {report.matches.map((match) => (
                    <div
                      key={match.id}
                      className="bg-gray-700 p-4 rounded-lg border border-gray-600 hover:border-gray-500 cursor-pointer transition-colors"
                      onClick={() => setSelectedMatch(match)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className={`text-sm font-medium ${getMatchTypeColor(match.matchType)}`}>
                            {getMatchTypeLabel(match.matchType)}
                          </span>
                          <span className="text-xs text-gray-400">
                            Confiança: {(match.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-sm text-gray-300">
                          {match.sources.length} fonte(s)
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {match.sources.map((source, index) => (
                          <div key={index} className="bg-gray-600 p-3 rounded">
                            <div className="text-xs text-gray-400 mb-1">{source.sourceId}</div>
                            <div className="text-sm text-gray-200">
                              {source.record.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <div className="text-xs text-gray-400">{source.record.date}</div>
                            <div className="text-xs text-gray-500 truncate mt-1">
                              {source.record.originalHistory}
                            </div>
                          </div>
                        ))}
                      </div>

                      {match.discrepancies.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <div className="text-xs text-yellow-400 mb-1">
                            {match.discrepancies.length} discrepância(s)
                          </div>
                          {match.discrepancies.slice(0, 2).map((disc, index) => (
                            <div key={index} className="text-xs text-gray-400">
                              {disc.field}: {disc.reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedTab === 'conflicts' && (
                <div className="space-y-4">
                  {report.matches.filter(m => m.discrepancies.length > 0).map((match) => (
                    <div key={match.id} className="bg-gray-700 p-4 rounded-lg border border-red-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-red-400">
                          Conflito Detectado
                        </div>
                        <div className="text-xs text-gray-400">
                          Confiança: {(match.confidence * 100).toFixed(1)}%
                        </div>
                      </div>

                      <div className="space-y-2">
                        {match.discrepancies.map((disc, index) => (
                          <div key={index} className="bg-red-900/20 p-3 rounded border border-red-800">
                            <div className={`text-sm font-medium ${getSeverityColor(disc.severity)}`}>
                              {disc.field.toUpperCase()}: {disc.reason}
                            </div>
                            <div className="mt-2 space-y-1">
                              {Object.entries(disc.values).map(([sourceId, value]) => (
                                <div key={sourceId} className="text-xs text-gray-400">
                                  {sourceId}: {typeof value === 'number' ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTab === 'unmatched' && (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">
                    Lista de registros não correspondidos em desenvolvimento.
                    <br />
                    Total: {report.summary.unmatchedRecords} registros
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Relatório gerado em {report.generatedAt.toLocaleString('pt-BR')}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleExportReport}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                >
                  Exportar Relatório
                </button>
                <button
                  onClick={() => setReport(null)}
                  className="px-4 py-2 text-sm font-medium text-indigo-400 bg-indigo-900/20 border border-indigo-800 rounded hover:bg-indigo-900/30 transition-colors"
                >
                  Nova Reconciliação
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};