import { useEffect, useRef, useCallback } from 'react';

export interface KeyboardShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface FocusTargets {
  valueInput?: HTMLInputElement | null;
  dateFilter?: HTMLInputElement | null;
  conferenceValue?: HTMLInputElement | null;
}

/**
 * Custom hook for managing keyboard shortcuts
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcutConfig[],
  isActive: boolean = true
) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isActive) return;

    // Don't interfere with inputs that should handle their own keyboard events
    const target = event.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
      const altMatches = !!shortcut.altKey === event.altKey;
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey;

      if (keyMatches && ctrlMatches && altMatches && shiftMatches) {
        // Special handling for Enter key - only trigger if not in an input that should handle it
        if (shortcut.key.toLowerCase() === 'enter' && isInInput) {
          // Let inputs handle Enter themselves
          continue;
        }

        // Special handling for Escape - always allow it to work
        if (shortcut.key.toLowerCase() === 'escape') {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation !== false) {
            event.stopPropagation();
          }
          shortcut.action();
          return;
        }

        // For other shortcuts with modifiers, always allow them
        if (shortcut.ctrlKey || shortcut.altKey || shortcut.shiftKey) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation !== false) {
            event.stopPropagation();
          }
          shortcut.action();
          return;
        }

        // For regular key shortcuts, only trigger if not in an input
        if (!isInInput) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation !== false) {
            event.stopPropagation();
          }
          shortcut.action();
          return;
        }
      }
    }
  }, [shortcuts, isActive]);

  useEffect(() => {
    if (!isActive) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, isActive]);
};

/**
 * Hook for managing focus targets and providing focus utilities
 */
export const useFocusManager = () => {
  const focusTargets = useRef<FocusTargets>({});

  const registerFocusTarget = useCallback((name: keyof FocusTargets, element: HTMLInputElement | null) => {
    focusTargets.current[name] = element;
  }, []);

  const focusTarget = useCallback((name: keyof FocusTargets) => {
    const target = focusTargets.current[name];
    if (target) {
      target.focus();
      target.select?.(); // Select text if it's an input
    }
  }, []);

  const getFocusTarget = useCallback((name: keyof FocusTargets) => {
    return focusTargets.current[name];
  }, []);

  return {
    registerFocusTarget,
    focusTarget,
    getFocusTarget
  };
};

/**
 * Hook for restoring focus after an action
 */
export const useFocusRestore = () => {
  const previousFocus = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousFocus.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocus.current && typeof previousFocus.current.focus === 'function') {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        if (previousFocus.current) {
          previousFocus.current.focus();
        }
      }, 0);
    }
  }, []);

  return {
    saveFocus,
    restoreFocus
  };
};

/**
 * Global keyboard shortcuts hook that works across the entire application
 */
export const useGlobalKeyboardShortcuts = (
  focusTargets: FocusTargets,
  callbacks: {
    openDateFilter?: () => void;
    closeModals?: () => void;
    confirmAction?: () => void;
  }
) => {
  const shortcuts: KeyboardShortcutConfig[] = [
    {
      key: 'l',
      ctrlKey: true,
      action: () => {
        if (focusTargets.valueInput) {
          focusTargets.valueInput.focus();
          focusTargets.valueInput.select();
        } else if (focusTargets.conferenceValue) {
          focusTargets.conferenceValue.focus();
          focusTargets.conferenceValue.select();
        }
      },
      description: 'Focar no campo de valor (Ctrl+L)'
    },
    {
      key: 'f',
      ctrlKey: true,
      action: () => {
        if (callbacks.openDateFilter) {
          callbacks.openDateFilter();
        } else if (focusTargets.dateFilter) {
          focusTargets.dateFilter.focus();
        }
      },
      description: 'Abrir filtro de data (Ctrl+F)'
    },
    {
      key: 'Escape',
      action: () => {
        if (callbacks.closeModals) {
          callbacks.closeModals();
        }
      },
      description: 'Fechar modais (Esc)'
    },
    {
      key: 'Enter',
      action: () => {
        if (callbacks.confirmAction) {
          callbacks.confirmAction();
        }
      },
      description: 'Confirmar ação (Enter)'
    }
  ];

  useKeyboardShortcuts(shortcuts, true);

  return shortcuts;
};

/**
 * Utility function to show keyboard shortcuts help
 */
export const getShortcutHelpText = (shortcuts: KeyboardShortcutConfig[]): string => {
  return shortcuts.map(shortcut => {
    const keys = [];
    if (shortcut.ctrlKey) keys.push('Ctrl');
    if (shortcut.altKey) keys.push('Alt');
    if (shortcut.shiftKey) keys.push('Shift');
    keys.push(shortcut.key);

    return `${keys.join('+')} - ${shortcut.description}`;
  }).join('\n');
};