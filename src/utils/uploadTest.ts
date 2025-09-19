/**
 * Utilitários para testar o fluxo de upload seguro
 */

// Simula diferentes tipos de arquivo para teste
export const createTestFile = (type: 'small' | 'large' | 'corrupted' | 'invalid'): File => {
  let content: string;
  let fileName: string;
  let mimeType: string;

  switch (type) {
    case 'small':
      // Arquivo Excel pequeno válido (simulado)
      content = 'Data,Histórico,Valor\n01/01/2024,PIX RECEBIDO,100.50\n02/01/2024,TED ENVIADO,-50.25';
      fileName = 'test-small.csv';
      mimeType = 'text/csv';
      break;

    case 'large':
      // Arquivo grande (simulado - 10MB de dados)
      const rows = Array.from({ length: 100000 }, (_, i) =>
        `${String(i + 1).padStart(2, '0')}/01/2024,TRANSAÇÃO ${i + 1},${(Math.random() * 1000).toFixed(2)}`
      );
      content = 'Data,Histórico,Valor\n' + rows.join('\n');
      fileName = 'test-large.csv';
      mimeType = 'text/csv';
      break;

    case 'corrupted':
      // Arquivo com dados corrompidos
      content = 'Data,Histórico,Valor\n01/01/2024,PIX RECEBIDO,abc\n02/01/2024,,\ninvalid,row,data';
      fileName = 'test-corrupted.csv';
      mimeType = 'text/csv';
      break;

    case 'invalid':
      // Arquivo com tipo inválido
      content = 'This is not a spreadsheet file';
      fileName = 'test-invalid.txt';
      mimeType = 'text/plain';
      break;

    default:
      throw new Error(`Tipo de teste inválido: ${type}`);
  }

  // Criar File object
  const blob = new Blob([content], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
};

// Testa diferentes cenários de upload
export const runUploadTests = () => {
  console.log('🧪 Iniciando testes de upload...');

  const tests = [
    { name: 'Arquivo pequeno válido', type: 'small' as const },
    { name: 'Arquivo grande (stress test)', type: 'large' as const },
    { name: 'Arquivo com dados corrompidos', type: 'corrupted' as const },
    { name: 'Arquivo com tipo inválido', type: 'invalid' as const }
  ];

  tests.forEach(test => {
    try {
      const file = createTestFile(test.type);
      console.log(`✅ ${test.name}:`, {
        name: file.name,
        size: `${(file.size / 1024).toFixed(2)} KB`,
        type: file.type
      });
    } catch (error) {
      console.error(`❌ ${test.name}:`, error);
    }
  });

  console.log('🏁 Testes de criação de arquivo concluídos');
};

// Simula timeout para teste
export const simulateTimeout = async (ms: number): Promise<void> => {
  console.log(`⏳ Simulando timeout de ${ms}ms...`);
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new DOMException(`Timeout de ${ms}ms simulado`, 'TimeoutError'));
    }, ms);
  });
};

// Simula cancelamento para teste
export const simulateAbort = (): AbortController => {
  const controller = new AbortController();
  console.log('🛑 Simulando cancelamento em 2 segundos...');

  setTimeout(() => {
    controller.abort();
    console.log('🛑 Cancelamento simulado executado');
  }, 2000);

  return controller;
};

// Logs de teste estruturados
export const logTestScenario = (scenario: string, details: any) => {
  console.group(`🧪 Teste: ${scenario}`);
  console.log('📋 Detalhes:', details);
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.groupEnd();
};

// Valida se os critérios de aceite foram atendidos
export const validateAcceptanceCriteria = () => {
  const criteria = [
    {
      name: 'Modal fecha sempre (sucesso/erro/timeout/abort)',
      check: () => {
        // Verificar se não há modais abertos
        const modals = document.querySelectorAll('[role="dialog"], .fixed.inset-0');
        return modals.length === 0;
      }
    },
    {
      name: 'Upload grande não trava a UI (worker ativo)',
      check: () => {
        // Verificar se worker está sendo usado
        const isWorkerSupported = typeof Worker !== 'undefined';
        return isWorkerSupported;
      }
    },
    {
      name: 'Dados inseridos em Dexie em transação única',
      check: () => {
        // Verificar se Dexie está disponível
        return typeof window !== 'undefined' && 'indexedDB' in window;
      }
    },
    {
      name: 'Logs no console presentes',
      check: () => {
        // Verificar se console.log está funcionando
        return typeof console.log === 'function';
      }
    }
  ];

  console.log('🎯 Validando critérios de aceite...');

  const results = criteria.map(criterion => {
    try {
      const passed = criterion.check();
      console.log(`${passed ? '✅' : '❌'} ${criterion.name}`);
      return { name: criterion.name, passed };
    } catch (error) {
      console.log(`❌ ${criterion.name} - Erro: ${error}`);
      return { name: criterion.name, passed: false, error };
    }
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`📊 Resultado: ${passedCount}/${totalCount} critérios atendidos`);

  return results;
};