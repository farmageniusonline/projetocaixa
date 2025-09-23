import { test, expect } from '@playwright/test';

test.describe('Debug de Performance - Aba Lançamentos', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Monitorar requests de rede
    page.on('request', request => {
      console.log(`🔄 REQUEST: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      console.log(`📥 RESPONSE: ${response.status()} ${response.url()} - ${response.headers()['content-length'] || 'unknown'} bytes`);
    });

    // Interceptar erros de console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ CONSOLE ERROR: ${msg.text()}`);
      }
    });

    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);

    // Navegar para Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);
  });

  test('🐛 Diagnosticar Performance ao Preencher Valor', async ({ page }) => {
    console.log('=== 🕵️ TESTE DE PERFORMANCE - PREENCHIMENTO DE VALOR ===');

    // Medir tempo de carregamento inicial
    const startTime = Date.now();

    // Selecionar método de pagamento
    console.log('📝 Selecionando método de pagamento...');
    const selectTime = Date.now();
    await page.click('button[aria-label="Dinheiro"]');
    console.log(`⏱️ Tempo para selecionar método: ${Date.now() - selectTime}ms`);

    // Focar no campo de valor
    console.log('🎯 Focando no campo de valor...');
    const focusTime = Date.now();
    await page.click('#launch-value-input');
    console.log(`⏱️ Tempo para focar: ${Date.now() - focusTime}ms`);

    // Testar preenchimento character por character
    const testValue = '123,45';
    console.log('⌨️ Testando digitação character por character...');

    for (let i = 0; i < testValue.length; i++) {
      const charTime = Date.now();
      const char = testValue[i];

      await page.type('#launch-value-input', char, { delay: 0 });

      // Aguardar qualquer processamento
      await page.waitForTimeout(100);

      const currentValue = await page.inputValue('#launch-value-input');
      const processingTime = Date.now() - charTime;

      console.log(`📝 Char '${char}': ${processingTime}ms - Valor atual: '${currentValue}'`);

      if (processingTime > 500) {
        console.log(`🚨 ALERTA: Processamento lento detectado para character '${char}' - ${processingTime}ms`);
      }
    }

    // Testar adição do lançamento
    console.log('💾 Testando adição do lançamento...');
    const addTime = Date.now();
    await page.click('button:has-text("Adicionar")');

    // Aguardar o loading state
    await page.waitForSelector('.animate-spin', { timeout: 30000 });
    console.log(`⏳ Loading iniciado após: ${Date.now() - addTime}ms`);

    // Aguardar o loading terminar
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 30000 });
    const totalAddTime = Date.now() - addTime;
    console.log(`✅ Lançamento adicionado em: ${totalAddTime}ms`);

    // Verificar se apareceu na tabela
    const tableCheck = Date.now();
    const newRowVisible = await page.isVisible('tbody tr:first-child');
    console.log(`📊 Linha na tabela visível: ${newRowVisible} - Verificação: ${Date.now() - tableCheck}ms`);

    // Medir tempo total
    const totalTime = Date.now() - startTime;
    console.log(`⏱️ TEMPO TOTAL: ${totalTime}ms`);

    // Performance thresholds
    const performanceReport = {
      selectionTime: Date.now() - selectTime,
      additionTime: totalAddTime,
      totalTime: totalTime,
      acceptable: totalAddTime < 3000, // 3 segundos max
      fast: totalAddTime < 1000, // 1 segundo é bom
      tableUpdated: newRowVisible
    };

    console.log('📊 RELATÓRIO DE PERFORMANCE:', JSON.stringify(performanceReport, null, 2));

    if (!performanceReport.acceptable) {
      console.log(`🚨 PROBLEMA DE PERFORMANCE DETECTADO: ${totalAddTime}ms > 3000ms`);
    }

    expect(performanceReport.tableUpdated).toBe(true);
  });

  test('🔍 Analisar Network Requests Durante Adição', async ({ page }) => {
    console.log('=== 🌐 ANÁLISE DE NETWORK REQUESTS ===');

    const networkRequests: any[] = [];

    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
        type: 'request'
      });
    });

    page.on('response', response => {
      networkRequests.push({
        url: response.url(),
        status: response.status(),
        timestamp: Date.now(),
        type: 'response',
        size: response.headers()['content-length'] || 'unknown'
      });
    });

    // Selecionar método e preencher valor
    await page.click('button[aria-label="Débito"]');
    await page.fill('#launch-value-input', '50,00');

    // Limpar requests anteriores
    networkRequests.length = 0;

    console.log('📡 Iniciando monitoramento de requests...');
    const startTime = Date.now();

    // Adicionar lançamento
    await page.click('button:has-text("Adicionar")');

    // Aguardar processos
    await page.waitForTimeout(5000);

    console.log('📋 REQUESTS CAPTURADOS:');
    networkRequests.forEach((req, index) => {
      const timeSinceStart = req.timestamp - startTime;
      console.log(`${index + 1}. [${timeSinceStart}ms] ${req.type.toUpperCase()}: ${req.method || req.status} ${req.url}`);
      if (req.size) console.log(`   📦 Size: ${req.size} bytes`);
    });

    // Analisar requests do Supabase
    const supabaseRequests = networkRequests.filter(req =>
      req.url.includes('supabase') || req.url.includes('postgres')
    );

    console.log(`🗄️ SUPABASE REQUESTS: ${supabaseRequests.length}`);
    supabaseRequests.forEach(req => {
      console.log(`   - ${req.type}: ${req.method || req.status} ${req.url}`);
    });

    expect(supabaseRequests.length).toBeGreaterThan(0);
  });

  test('🧠 Analisar Estado dos Components React', async ({ page }) => {
    console.log('=== ⚛️ ANÁLISE DE ESTADO REACT ===');

    // Injetar script para monitorar re-renders
    await page.addInitScript(() => {
      // @ts-ignore
      window.renderCount = 0;

      // Hook nos métodos do React
      const originalSetState = React.Component.prototype.setState;
      React.Component.prototype.setState = function(...args) {
        // @ts-ignore
        window.renderCount++;
        console.log(`⚛️ Component setState called - Total renders: ${window.renderCount}`);
        return originalSetState.apply(this, args);
      };
    });

    // Selecionar método
    await page.click('button[aria-label="Moedas"]');

    // Analisar estado antes da digitação
    const initialRenderCount = await page.evaluate(() => {
      // @ts-ignore
      return window.renderCount || 0;
    });
    console.log(`🎯 Renders iniciais: ${initialRenderCount}`);

    // Digitar valor character por character
    const testValue = '75,30';
    for (const char of testValue) {
      await page.type('#launch-value-input', char, { delay: 100 });

      const currentRenderCount = await page.evaluate(() => {
        // @ts-ignore
        return window.renderCount || 0;
      });

      console.log(`📝 Char '${char}' - Renders: ${currentRenderCount}`);
    }

    // Verificar renders excessivos
    const finalRenderCount = await page.evaluate(() => {
      // @ts-ignore
      return window.renderCount || 0;
    });

    const totalRenders = finalRenderCount - initialRenderCount;
    console.log(`📊 TOTAL DE RENDERS DURANTE DIGITAÇÃO: ${totalRenders}`);

    if (totalRenders > testValue.length * 3) {
      console.log(`🚨 POSSÍVEL PROBLEMA: Muitos re-renders (${totalRenders}) para ${testValue.length} caracteres`);
    }

    // Adicionar lançamento e medir renders
    const preAddRenders = finalRenderCount;
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(3000);

    const postAddRenders = await page.evaluate(() => {
      // @ts-ignore
      return window.renderCount || 0;
    });

    const addRenders = postAddRenders - preAddRenders;
    console.log(`💾 RENDERS DURANTE ADIÇÃO: ${addRenders}`);

    expect(totalRenders).toBeLessThan(testValue.length * 5); // Threshold razoável
  });

  test('📊 Benchmark de Múltiplos Lançamentos', async ({ page }) => {
    console.log('=== 📈 BENCHMARK DE MÚLTIPLOS LANÇAMENTOS ===');

    const testCases = [
      { method: 'Dinheiro', value: '10,00' },
      { method: 'Débito', value: '25,50' },
      { method: 'Cartão de Crédito 1x', value: '100,00', needsLink: true },
      { method: 'Moedas', value: '5,75' },
      { method: 'Depósito', value: '200,00' }
    ];

    const timings: Array<{method: string, time: number}> = [];

    for (const testCase of testCases) {
      console.log(`🧪 Testando: ${testCase.method} - ${testCase.value}`);

      const startTime = Date.now();

      // Selecionar método
      await page.click(`button[aria-label="${testCase.method}"]`);

      // Se for cartão de crédito, selecionar Link
      if (testCase.needsLink) {
        await page.click('button:has-text("Não")');
      }

      // Preencher valor
      await page.fill('#launch-value-input', testCase.value);

      // Adicionar
      await page.click('button:has-text("Adicionar")');

      // Aguardar processamento
      await page.waitForSelector('.animate-spin', { timeout: 10000 });
      await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      timings.push({
        method: testCase.method,
        time: duration
      });

      console.log(`✅ ${testCase.method}: ${duration}ms`);

      // Pequena pausa entre testes
      await page.waitForTimeout(1000);
    }

    console.log('📊 RESUMO DO BENCHMARK:');
    timings.forEach(timing => {
      const status = timing.time < 2000 ? '🟢' : timing.time < 5000 ? '🟡' : '🔴';
      console.log(`${status} ${timing.method}: ${timing.time}ms`);
    });

    const avgTime = timings.reduce((sum, t) => sum + t.time, 0) / timings.length;
    const maxTime = Math.max(...timings.map(t => t.time));
    const minTime = Math.min(...timings.map(t => t.time));

    console.log(`📈 ESTATÍSTICAS:`);
    console.log(`  Média: ${avgTime.toFixed(0)}ms`);
    console.log(`  Máximo: ${maxTime}ms`);
    console.log(`  Mínimo: ${minTime}ms`);

    // Verificar se todos os lançamentos apareceram na tabela
    const rowCount = await page.locator('tbody tr').count();
    console.log(`📋 Lançamentos na tabela: ${rowCount}`);

    expect(rowCount).toBe(testCases.length);
    expect(avgTime).toBeLessThan(3000); // Média aceitável
  });
});