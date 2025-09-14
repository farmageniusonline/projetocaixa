import React, { useState, useEffect } from 'react';
import { actionHistory, ActionHistoryState, ActionHistoryItem } from '../utils/actionHistory';

interface ActionHistoryPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onUndo: (action: ActionHistoryItem) => void;
  onRedo: (action: ActionHistoryItem) => void;
}

export const ActionHistoryPanel: React.FC<ActionHistoryPanelProps> = ({
  isOpen,
  onToggle,
  onUndo,
  onRedo
}) => {
  const [historyState, setHistoryState] = useState<ActionHistoryState>(actionHistory.getState());
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const unsubscribe = actionHistory.subscribe(setHistoryState);
    return unsubscribe;
  }, []);

  const handleUndo = () => {
    const actionToUndo = actionHistory.undo();
    if (actionToUndo) {
      onUndo(actionToUndo);
    }
  };

  const handleRedo = () => {
    const actionToRedo = actionHistory.redo();
    if (actionToRedo) {
      onRedo(actionToRedo);
    }
  };

  const getActionIcon = (type: string): string => {
    switch (type) {
      case 'TRANSFER_TO_CASH':
        return '💰';
      case 'REMOVE_FROM_CASH':
        return '↩️';
      case 'ADD_TO_NOT_FOUND':
        return '❌';
      case 'CLEAR_NOT_FOUND':
        return '🗑️';
      case 'RESTART_DAY':
        return '🔄';
      case 'LOAD_FILE':
        return '📁';
      case 'CLEAR_FILE':
        return '🧹';
      default:
        return '⚡';
    }
  };

  const getActionColor = (type: string): string => {
    switch (type) {
      case 'TRANSFER_TO_CASH':
        return 'text-green-400';
      case 'REMOVE_FROM_CASH':
        return 'text-yellow-400';
      case 'ADD_TO_NOT_FOUND':
        return 'text-red-400';
      case 'CLEAR_NOT_FOUND':
        return 'text-orange-400';
      case 'RESTART_DAY':
        return 'text-purple-400';
      case 'LOAD_FILE':
        return 'text-blue-400';
      case 'CLEAR_FILE':
        return 'text-gray-400';
      default:
        return 'text-gray-300';
    }
  };

  const displayedActions = showAll
    ? historyState.history
    : actionHistory.getRecentActions(10);

  const canUndo = actionHistory.canUndo();
  const canRedo = actionHistory.canRedo();

  return (
    <div className={`fixed left-0 top-16 h-full bg-gray-800 border-r border-gray-700 transition-transform duration-300 z-40 ${
      isOpen ? 'transform translate-x-0' : 'transform -translate-x-full'
    }`} style={{ width: '350px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-gray-100">Histórico de Ações</h3>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-200 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex space-x-2">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Desfazer
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
            </svg>
            Refazer
          </button>
        </div>

        {/* Keyboard shortcuts info */}
        <div className="mt-3 p-2 bg-gray-700 rounded text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Desfazer:</span>
            <kbd className="px-1 bg-gray-600 rounded">Ctrl+Z</kbd>
          </div>
          <div className="flex justify-between mt-1">
            <span>Refazer:</span>
            <kbd className="px-1 bg-gray-600 rounded">Ctrl+Y</kbd>
          </div>
        </div>
      </div>

      {/* History Statistics */}
      <div className="p-4 border-b border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-100">{historyState.history.length}</div>
            <div className="text-xs text-gray-400">Total de Ações</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-100">
              {historyState.currentIndex === -1 ? historyState.history.length : historyState.currentIndex + 1}
            </div>
            <div className="text-xs text-gray-400">Posição Atual</div>
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-300">
              {showAll ? 'Todas as Ações' : 'Ações Recentes'}
            </h4>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showAll ? 'Mostrar Recentes' : 'Mostrar Todas'}
            </button>
          </div>

          {displayedActions.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-sm text-gray-400">Nenhuma ação realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedActions.map((action, index) => {
                const isCurrentAction = historyState.currentIndex === -1
                  ? index === displayedActions.length - 1
                  : index <= historyState.currentIndex;

                const isFutureAction = historyState.currentIndex !== -1 && index > historyState.currentIndex;

                return (
                  <div
                    key={action.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isCurrentAction && !isFutureAction
                        ? 'bg-gray-700 border-gray-600'
                        : isFutureAction
                        ? 'bg-gray-800/50 border-gray-700 opacity-50'
                        : 'bg-gray-800 border-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg flex-shrink-0 mt-0.5">
                        {getActionIcon(action.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${getActionColor(action.type)}`}>
                          {action.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {action.timestamp.toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      {isFutureAction && (
                        <div className="flex-shrink-0">
                          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                            Desfeita
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clear History Button */}
      {historyState.history.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja limpar todo o histórico de ações?')) {
                actionHistory.clearHistory();
              }
            }}
            className="w-full px-3 py-2 text-sm font-medium text-red-400 bg-red-900/20 border border-red-800 rounded hover:bg-red-900/30 transition-colors"
          >
            Limpar Histórico
          </button>
        </div>
      )}
    </div>
  );
};