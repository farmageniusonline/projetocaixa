import * as XLSX from 'xlsx';
import * as Comlink from 'comlink';

console.log('🔧 Test Worker: Carregado com sucesso');

// Simple test worker to diagnose XLSX issues
class TestExcelProcessor {
  async testBasicProcessing(fileBuffer: ArrayBuffer): Promise<{ success: boolean; message: string; rowCount?: number }> {
    console.log('🧪 Test Worker: Iniciando teste básico...', { bufferSize: fileBuffer.byteLength });

    try {
      console.log('🧪 Test Worker: Tentando ler workbook...');

      // Simpler read options
      const workbook = XLSX.read(fileBuffer, {
        type: 'array'
      });

      console.log('🧪 Test Worker: Workbook lido com sucesso', { sheets: workbook.SheetNames });

      if (workbook.SheetNames.length === 0) {
        return { success: false, message: 'Nenhuma planilha encontrada' };
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      console.log('🧪 Test Worker: Convertendo para JSON...');
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      console.log('🧪 Test Worker: Conversão concluída', { rowCount: jsonData.length });

      return {
        success: true,
        message: `Processamento concluído com sucesso`,
        rowCount: jsonData.length
      };

    } catch (error) {
      console.error('🧪 Test Worker: Erro no processamento:', error);
      return {
        success: false,
        message: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }
}

const testProcessor = new TestExcelProcessor();
const testAPI = {
  testBasicProcessing: testProcessor.testBasicProcessing.bind(testProcessor)
};

Comlink.expose(testAPI);

export type TestWorkerAPI = typeof testAPI;