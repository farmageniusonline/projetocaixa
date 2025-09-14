import React, { useState, useEffect } from 'react';
import { templateManager, BankTemplate, bankTemplates } from '../utils/bankTemplates';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelect?: (template: BankTemplate) => void;
  currentTemplate?: string;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({
  isOpen,
  onClose,
  onTemplateSelect,
  currentTemplate
}) => {
  const [templates, setTemplates] = useState<BankTemplate[]>([]);
  const [selectedTab, setSelectedTab] = useState<'browse' | 'create' | 'import'>('browse');
  const [editingTemplate, setEditingTemplate] = useState<BankTemplate | null>(null);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTemplates(templateManager.getAllTemplates());
    }
  }, [isOpen]);

  const handleTemplateSelect = (template: BankTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  const handleCreateTemplate = () => {
    const newTemplate: BankTemplate = {
      id: `custom_${Date.now()}`,
      name: 'Novo Template',
      description: 'Template personalizado',
      version: '1.0.0',
      columns: {
        date: {
          name: 'Data',
          aliases: ['data'],
          required: true,
          dataType: 'date'
        },
        history: {
          name: 'Histórico',
          aliases: ['histórico', 'descrição'],
          required: true,
          dataType: 'text'
        }
      },
      parsingRules: {
        cpf: [],
        paymentType: [],
        value: []
      },
      config: {
        dateFormats: ['dd/mm/yyyy'],
        currencySymbols: ['R$'],
        decimalSeparator: ',',
        thousandSeparator: '.',
        headerRowHints: []
      },
      validation: {
        requiredColumns: ['date', 'history'],
        minRows: 1,
        maxEmptyRows: 10
      }
    };

    setEditingTemplate(newTemplate);
    setSelectedTab('create');
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      templateManager.createCustomTemplate(editingTemplate);
      setTemplates(templateManager.getAllTemplates());
      setEditingTemplate(null);
      setSelectedTab('browse');
    }
  };

  const handleImportTemplate = () => {
    if (templateManager.importTemplate(importText)) {
      setTemplates(templateManager.getAllTemplates());
      setImportText('');
      setSelectedTab('browse');
      alert('Template importado com sucesso!');
    } else {
      alert('Erro ao importar template. Verifique o formato JSON.');
    }
  };

  const handleExportTemplate = (template: BankTemplate) => {
    const exported = templateManager.exportTemplate(template.id);
    if (exported) {
      const blob = new Blob([exported], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `template-${template.id}.json`;
      link.click();
    }
  };

  const handleDeleteTemplate = (template: BankTemplate) => {
    if (confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
      if (templateManager.deleteCustomTemplate(template.id)) {
        setTemplates(templateManager.getAllTemplates());
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-100">Gerenciar Templates de Bancos</h3>
            <p className="text-sm text-gray-400">Configure templates específicos para diferentes instituições bancárias</p>
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

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 border-b border-gray-700">
          <button
            onClick={() => setSelectedTab('browse')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedTab === 'browse'
                ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
            }`}
          >
            Templates Disponíveis
          </button>
          <button
            onClick={() => setSelectedTab('create')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedTab === 'create'
                ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
            }`}
          >
            Criar/Editar
          </button>
          <button
            onClick={() => setSelectedTab('import')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              selectedTab === 'import'
                ? 'bg-gray-700 text-gray-100 border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
            }`}
          >
            Importar/Exportar
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedTab === 'browse' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h4 className="text-lg font-medium text-gray-300">Templates Disponíveis ({templates.length})</h4>
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
                >
                  + Criar Novo Template
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {templates.map(template => {
                  const isDefault = Object.values(bankTemplates).some(t => t.id === template.id);
                  const isCurrent = template.id === currentTemplate;

                  return (
                    <div
                      key={template.id}
                      className={`p-4 bg-gray-700 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-900/20'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {template.logo && (
                            <span className="text-2xl">{template.logo}</span>
                          )}
                          <div>
                            <h5 className="font-medium text-gray-100 flex items-center">
                              {template.name}
                              {isCurrent && (
                                <span className="ml-2 px-2 py-1 text-xs bg-indigo-600 text-white rounded">
                                  Atual
                                </span>
                              )}
                              {isDefault && (
                                <span className="ml-2 px-2 py-1 text-xs bg-gray-600 text-gray-300 rounded">
                                  Padrão
                                </span>
                              )}
                            </h5>
                            <p className="text-sm text-gray-400">{template.description}</p>
                            <p className="text-xs text-gray-500">v{template.version}</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 mb-3">
                        <div><strong>Colunas obrigatórias:</strong> {template.validation.requiredColumns.join(', ')}</div>
                        <div><strong>Formato de data:</strong> {template.config.dateFormats.join(', ')}</div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleTemplateSelect(template)}
                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
                        >
                          Usar Template
                        </button>
                        <button
                          onClick={() => handleExportTemplate(template)}
                          className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded hover:bg-gray-500 transition-colors"
                          title="Exportar"
                        >
                          📤
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => handleDeleteTemplate(template)}
                            className="px-3 py-2 text-sm font-medium text-red-400 bg-red-900/20 rounded hover:bg-red-900/30 transition-colors"
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedTab === 'create' && editingTemplate && (
            <div>
              <h4 className="text-lg font-medium text-gray-300 mb-4">
                {editingTemplate.id.startsWith('custom_') ? 'Criar Novo Template' : 'Editar Template'}
              </h4>

              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Versão</label>
                    <input
                      type="text"
                      value={editingTemplate.version}
                      onChange={(e) => setEditingTemplate({...editingTemplate, version: e.target.value})}
                      className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                  <textarea
                    value={editingTemplate.description}
                    onChange={(e) => setEditingTemplate({...editingTemplate, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Column Mappings */}
                <div>
                  <h5 className="text-md font-medium text-gray-300 mb-3">Mapeamento de Colunas</h5>
                  <div className="space-y-4">
                    {Object.entries(editingTemplate.columns).map(([key, column]) => (
                      <div key={key} className="p-4 bg-gray-700 rounded border border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <h6 className="font-medium text-gray-200">{column.name}</h6>
                          <div className="flex items-center space-x-2">
                            <label className="flex items-center text-xs text-gray-400">
                              <input
                                type="checkbox"
                                checked={column.required}
                                onChange={(e) => {
                                  const updatedColumns = {...editingTemplate.columns};
                                  updatedColumns[key as keyof typeof updatedColumns]!.required = e.target.checked;
                                  setEditingTemplate({...editingTemplate, columns: updatedColumns});
                                }}
                                className="mr-1"
                              />
                              Obrigatório
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Aliases (separados por vírgula)</label>
                          <input
                            type="text"
                            value={column.aliases.join(', ')}
                            onChange={(e) => {
                              const updatedColumns = {...editingTemplate.columns};
                              updatedColumns[key as keyof typeof updatedColumns]!.aliases = e.target.value.split(',').map(s => s.trim());
                              setEditingTemplate({...editingTemplate, columns: updatedColumns});
                            }}
                            className="w-full px-3 py-2 text-xs text-gray-100 bg-gray-600 border border-gray-500 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="data, date, dt"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setEditingTemplate(null);
                      setSelectedTab('browse');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
                  >
                    Salvar Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'import' && (
            <div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-300 mb-4">Importar Template</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">JSON do Template</label>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={15}
                      placeholder="Cole aqui o JSON do template..."
                      className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div className="mt-3 flex space-x-3">
                    <button
                      onClick={handleImportTemplate}
                      disabled={!importText.trim()}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Importar Template
                    </button>
                    <button
                      onClick={() => setImportText('')}
                      className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-300 mb-4">Exportar Template</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    Selecione um template da lista acima e clique no botão de exportar (📤) para baixar o arquivo JSON.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};