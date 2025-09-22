import React, { useState } from 'react';
import { backupService, DayBackup } from '../services/backupService';
import { formatToDDMMYYYY, formatForDateInput, formatDateTimeForDisplay } from '../utils/dateFormatter';
import toast from 'react-hot-toast';

interface BackupPanelProps {
  className?: string;
}

export const BackupPanel: React.FC<BackupPanelProps> = ({
  className = ''
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    formatForDateInput(new Date())
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<DayBackup | null>(null);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const backupDate = formatToDDMMYYYY(selectedDate);
      const backup = await backupService.exportDayBackup(backupDate);

      backupService.downloadBackup(backup);

      toast.success(`Backup do dia ${backupDate} exportado com sucesso! ${backup.metadata.total_records} registros.`);
    } catch (error) {
      console.error('Error exporting backup:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setBackupPreview(null);
    setImportResults(null);

    try {
      const backup = await backupService.readBackupFromFile(file);
      const validation = backupService.validateBackup(backup);

      if (!validation.valid) {
        toast.error(`Backup inválido: ${validation.errors.join(', ')}`);
        setSelectedFile(null);
        return;
      }

      setBackupPreview(backup);
      toast.success('Backup carregado e validado com sucesso!');
    } catch (error) {
      console.error('Error reading backup file:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao ler arquivo de backup');
      setSelectedFile(null);
    }
  };

  const handleImportBackup = async (mergeMode: 'replace' | 'merge') => {
    if (!backupPreview) return;

    setIsImporting(true);
    try {
      const results = await backupService.importDayBackup(backupPreview, mergeMode);
      setImportResults(results);

      if (results.errors.length > 0) {
        toast.error(`Importação concluída com ${results.errors.length} erros. ${results.imported} importados, ${results.skipped} ignorados.`);
      } else {
        toast.success(`Backup importado com sucesso! ${results.imported} registros importados, ${results.skipped} ignorados.`);
      }
    } catch (error) {
      console.error('Error importing backup:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao importar backup');
    } finally {
      setIsImporting(false);
    }
  };

  const clearImport = () => {
    setSelectedFile(null);
    setBackupPreview(null);
    setImportResults(null);
    // Reset file input
    const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-100 mb-4 flex items-center">
        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">
          💾
        </span>
        Backup e Restauração
      </h3>

      <div className="space-y-6">
        {/* Export Section */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
          <h4 className="text-sm font-medium text-gray-200 mb-3 flex items-center">
            <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Exportar Backup do Dia
          </h4>

          <div className="space-y-3">
            <div>
              <label htmlFor="backup-date-input" className="block text-xs text-gray-400 mb-1">
                Data para backup
              </label>
              <input
                id="backup-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exportando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Exportar Backup JSON
                </>
              )}
            </button>

            <p className="text-xs text-gray-400">
              Exporta todas as tabelas do dia selecionado em formato JSON para backup seguro.
            </p>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
          <h4 className="text-sm font-medium text-gray-200 mb-3 flex items-center">
            <svg className="w-4 h-4 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Importar Backup
          </h4>

          <div className="space-y-3">
            <div>
              <label htmlFor="backup-file-input" className="block text-xs text-gray-400 mb-1">
                Selecionar arquivo de backup (.json)
              </label>
              <input
                id="backup-file-input"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white file:text-xs hover:file:bg-blue-700"
              />
            </div>

            {/* Backup Preview */}
            {backupPreview && (
              <div className="bg-gray-800 rounded p-3 border border-gray-600">
                <h5 className="text-xs font-medium text-gray-300 mb-2">Preview do Backup</h5>
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Data:</span>
                    <span className="text-gray-200">{backupPreview.backup_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exportado em:</span>
                    <span className="text-gray-200">{formatDateTimeForDisplay(backupPreview.export_timestamp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total registros:</span>
                    <span className="text-gray-200">{backupPreview.metadata.total_records}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Usuário:</span>
                    <span className="text-gray-200">{backupPreview.user_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Versão:</span>
                    <span className="text-gray-200">{backupPreview.version}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-600">
                  <h6 className="text-xs font-medium text-gray-300 mb-2">Registros por Tabela</h6>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Uploads:</span>
                      <span className="text-gray-200">{backupPreview.tables.bank_uploads.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bancário:</span>
                      <span className="text-gray-200">{backupPreview.tables.bank_entries.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Caixa:</span>
                      <span className="text-gray-200">{backupPreview.tables.cash_conference_entries.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Manual:</span>
                      <span className="text-gray-200">{backupPreview.tables.manual_entries.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Não encontrados:</span>
                      <span className="text-gray-200">{backupPreview.tables.not_found_history.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ações:</span>
                      <span className="text-gray-200">{backupPreview.tables.action_log.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Import Actions */}
            {backupPreview && !importResults && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleImportBackup('merge')}
                  disabled={isImporting}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? 'Importando...' : 'Mesclar'}
                </button>
                <button
                  onClick={() => handleImportBackup('replace')}
                  disabled={isImporting}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? 'Importando...' : 'Substituir'}
                </button>
                <button
                  onClick={clearImport}
                  disabled={isImporting}
                  className="px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Import Results */}
            {importResults && (
              <div className="bg-gray-800 rounded p-3 border border-gray-600">
                <h5 className="text-xs font-medium text-gray-300 mb-2">Resultado da Importação</h5>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Importados:</span>
                    <span className="text-green-400">{importResults.imported}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Ignorados:</span>
                    <span className="text-yellow-400">{importResults.skipped}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Erros:</span>
                    <span className="text-red-400">{importResults.errors.length}</span>
                  </div>
                </div>

                {importResults.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <h6 className="text-xs font-medium text-red-400 mb-2">Erros de Importação</h6>
                    <div className="max-h-32 overflow-y-auto custom-scrollbar">
                      {importResults.errors.map((error, index) => (
                        <div key={index} className="text-xs text-red-400 mb-1">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={clearImport}
                  className="mt-3 w-full px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Novo Backup
                </button>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-1">
              <p><strong>Mesclar:</strong> Mantém dados existentes, adiciona apenas novos registros.</p>
              <p><strong>Substituir:</strong> Remove todos os dados do dia e importa do backup.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};