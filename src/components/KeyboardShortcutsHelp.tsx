import React, { useState } from 'react';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  context?: string;
}

const shortcuts: KeyboardShortcut[] = [
  {
    keys: ['Ctrl', 'L'],
    description: 'Focar no campo de valor',
    context: 'Global'
  },
  {
    keys: ['Ctrl', 'F'],
    description: 'Focar no filtro de data',
    context: 'Global'
  },
  {
    keys: ['Enter'],
    description: 'Confirmar ação atual',
    context: 'Global'
  },
  {
    keys: ['Esc'],
    description: 'Fechar modais',
    context: 'Global'
  },
  // Navigation shortcuts
  {
    keys: ['Alt', '1'],
    description: 'Ir para aba Lançamentos',
    context: 'Navegação'
  },
  {
    keys: ['Alt', '2'],
    description: 'Ir para aba Banking',
    context: 'Navegação'
  },
  {
    keys: ['Alt', '3'],
    description: 'Ir para aba Conferência',
    context: 'Navegação'
  },
  {
    keys: ['Alt', '4'],
    description: 'Ir para aba Relatórios',
    context: 'Navegação'
  },
  {
    keys: ['Alt', '5'],
    description: 'Ir para aba Ações',
    context: 'Navegação'
  },
  {
    keys: ['Alt', '6'],
    description: 'Ir para aba Backup',
    context: 'Navegação'
  },
  // Action shortcuts
  {
    keys: ['Ctrl', 'E'],
    description: 'Exportar dados da aba atual',
    context: 'Ações'
  },
  {
    keys: ['Ctrl', 'R'],
    description: 'Atualizar dados',
    context: 'Ações'
  },
  {
    keys: ['Ctrl', 'Shift', 'M'],
    description: 'Abrir/fechar dashboard de métricas',
    context: 'Desenvolvimento'
  },
  {
    keys: ['Enter'],
    description: 'Adicionar lançamento',
    context: 'Lançamentos (quando no input de valor)'
  },
  {
    keys: ['Enter'],
    description: 'Selecionar primeiro item',
    context: 'Modal de seleção'
  }
];

export const KeyboardShortcutsHelp: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const renderKeys = (keys: string[]) => {
    return keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 && <span className="text-gray-400 mx-1">+</span>}
        <kbd className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 font-mono">
          {key}
        </kbd>
      </React.Fragment>
    ));
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 z-40 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors flex items-center space-x-2"
        title="Mostrar atalhos de teclado"
      >
        <span>⌨️</span>
        <span>Atalhos</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-96 max-h-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-100 flex items-center">
          ⌨️ Atalhos de Teclado
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          title="Fechar"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {renderKeys(shortcut.keys)}
                </div>
                <p className="text-sm text-gray-300">{shortcut.description}</p>
                {shortcut.context && (
                  <p className="text-xs text-gray-500 mt-1">{shortcut.context}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            <p className="mb-1">💡 <strong>Dicas:</strong></p>
            <ul className="space-y-1 ml-4">
              <li>• Os atalhos funcionam em toda a aplicação</li>
              <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-200">Ctrl+L</kbd> sempre foca no campo de valor mais próximo</li>
              <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-200">Enter</kbd> confirma a ação do contexto atual</li>
              <li>• <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-200">Esc</kbd> sempre fecha modais e volta o foco</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};