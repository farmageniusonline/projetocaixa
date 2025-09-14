/**
 * Action History System with Undo/Redo functionality
 * Tracks user actions and allows reverting changes
 */

export interface ActionHistoryItem {
  id: string;
  type: 'TRANSFER_TO_CASH' | 'REMOVE_FROM_CASH' | 'ADD_TO_NOT_FOUND' | 'CLEAR_NOT_FOUND' | 'RESTART_DAY' | 'LOAD_FILE' | 'CLEAR_FILE';
  description: string;
  timestamp: Date;
  data: any; // The data needed to undo this action
  undoData?: any; // The data needed to redo this action after undo
}

export interface ActionHistoryState {
  history: ActionHistoryItem[];
  currentIndex: number; // -1 means at the latest state
  maxHistorySize: number;
}

class ActionHistoryManager {
  private state: ActionHistoryState;
  private listeners: Array<(state: ActionHistoryState) => void> = [];

  constructor(maxHistorySize: number = 50) {
    this.state = {
      history: [],
      currentIndex: -1,
      maxHistorySize
    };
    this.loadFromStorage();
  }

  /**
   * Add a new action to the history
   */
  addAction(action: Omit<ActionHistoryItem, 'id' | 'timestamp'>): void {
    const newAction: ActionHistoryItem = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    // If we're not at the latest state (user has undone some actions),
    // we need to truncate the history from current position
    if (this.state.currentIndex !== -1) {
      this.state.history = this.state.history.slice(0, this.state.currentIndex + 1);
    }

    // Add the new action
    this.state.history.push(newAction);

    // Maintain max history size
    if (this.state.history.length > this.state.maxHistorySize) {
      this.state.history = this.state.history.slice(-this.state.maxHistorySize);
    }

    // Reset current index to latest
    this.state.currentIndex = -1;

    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Undo the last action
   */
  undo(): ActionHistoryItem | null {
    if (!this.canUndo()) return null;

    let targetIndex: number;
    if (this.state.currentIndex === -1) {
      // We're at the latest state, move to the last action
      targetIndex = this.state.history.length - 1;
    } else {
      // Move one step back
      targetIndex = this.state.currentIndex - 1;
    }

    if (targetIndex < 0) return null;

    this.state.currentIndex = targetIndex;
    const actionToUndo = this.state.history[targetIndex + (this.state.currentIndex === -1 ? 0 : 1)];

    this.saveToStorage();
    this.notifyListeners();

    return actionToUndo;
  }

  /**
   * Redo the next action
   */
  redo(): ActionHistoryItem | null {
    if (!this.canRedo()) return null;

    const targetIndex = this.state.currentIndex + 1;
    const actionToRedo = this.state.history[targetIndex];

    this.state.currentIndex = targetIndex === this.state.history.length - 1 ? -1 : targetIndex;

    this.saveToStorage();
    this.notifyListeners();

    return actionToRedo;
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    if (this.state.history.length === 0) return false;

    if (this.state.currentIndex === -1) {
      return this.state.history.length > 0;
    } else {
      return this.state.currentIndex >= 0;
    }
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    if (this.state.currentIndex === -1) return false;
    return this.state.currentIndex < this.state.history.length - 1;
  }

  /**
   * Get current history state
   */
  getState(): ActionHistoryState {
    return { ...this.state };
  }

  /**
   * Get the last N actions for display
   */
  getRecentActions(count: number = 10): ActionHistoryItem[] {
    const endIndex = this.state.currentIndex === -1
      ? this.state.history.length
      : this.state.currentIndex + 1;

    const startIndex = Math.max(0, endIndex - count);
    return this.state.history.slice(startIndex, endIndex);
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.state = {
      history: [],
      currentIndex: -1,
      maxHistorySize: this.state.maxHistorySize
    };
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ActionHistoryState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get action description for display
   */
  getActionDescription(action: ActionHistoryItem): string {
    const timeStr = action.timestamp.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${timeStr} - ${action.description}`;
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      const serializedState = {
        ...this.state,
        history: this.state.history.map(action => ({
          ...action,
          timestamp: action.timestamp.toISOString()
        }))
      };
      localStorage.setItem('actionHistory', JSON.stringify(serializedState));
    } catch (error) {
      console.warn('Failed to save action history to localStorage:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('actionHistory');
      if (stored) {
        const parsedState = JSON.parse(stored);
        this.state = {
          ...parsedState,
          history: parsedState.history.map((action: any) => ({
            ...action,
            timestamp: new Date(action.timestamp)
          }))
        };
      }
    } catch (error) {
      console.warn('Failed to load action history from localStorage:', error);
      this.state = {
        history: [],
        currentIndex: -1,
        maxHistorySize: this.state.maxHistorySize
      };
    }
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in action history listener:', error);
      }
    });
  }
}

// Global instance
export const actionHistory = new ActionHistoryManager();

/**
 * Hook for using action history in React components
 */
export function useActionHistory() {
  return actionHistory;
}

/**
 * Create action objects for common operations
 */
export const createActions = {
  transferToCash: (itemData: any, conferredId: string): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'TRANSFER_TO_CASH',
    description: `Transferiu R$ ${itemData.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para Conferência de Caixa`,
    data: { itemData, conferredId }
  }),

  removeFromCash: (itemData: any, conferredId: string): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'REMOVE_FROM_CASH',
    description: `Removeu R$ ${itemData.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} da Conferência de Caixa`,
    data: { itemData, conferredId }
  }),

  addToNotFound: (value: string): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'ADD_TO_NOT_FOUND',
    description: `Adicionou ${value} ao histórico de não encontrados`,
    data: { value, timestamp: new Date() }
  }),

  clearNotFound: (clearedCount: number): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'CLEAR_NOT_FOUND',
    description: `Limpou ${clearedCount} itens do histórico de não encontrados`,
    data: { clearedCount }
  }),

  restartDay: (clearedData: {
    conferredItems: any[];
    transferredIds: string[];
    notFoundHistory: any[];
  }): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'RESTART_DAY',
    description: 'Reiniciou o dia atual - todos os dados foram limpos',
    data: clearedData
  }),

  loadFile: (fileName: string, stats: any): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'LOAD_FILE',
    description: `Carregou arquivo: ${fileName} (${stats.totalRows} registros)`,
    data: { fileName, stats }
  }),

  clearFile: (): Omit<ActionHistoryItem, 'id' | 'timestamp'> => ({
    type: 'CLEAR_FILE',
    description: 'Limpou arquivo carregado e todos os dados',
    data: {}
  })
};

/**
 * Keyboard shortcuts handler
 */
export function setupKeyboardShortcuts(
  onUndo: () => void,
  onRedo: () => void
): () => void {
  const handleKeydown = (event: KeyboardEvent) => {
    // Ctrl+Z or Cmd+Z for undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      onUndo();
    }
    // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
    else if (
      ((event.ctrlKey || event.metaKey) && event.key === 'y') ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'z')
    ) {
      event.preventDefault();
      onRedo();
    }
  };

  document.addEventListener('keydown', handleKeydown);

  return () => {
    document.removeEventListener('keydown', handleKeydown);
  };
}