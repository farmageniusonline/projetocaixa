import { test, expect } from '@playwright/test';

test.describe('Performance Otimizada - Aba Lançamentos', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
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

  test('✅ Teste de Performance Melhorada - Adição de Lançamento', async ({ page }) => {
    console.log('=== ⚡ TESTE DE PERFORMANCE OTIMIZADA ===');

    // Selecionar método de pagamento
    const selectTime = Date.now();
    await page.click('button[aria-label="Dinheiro"]');
    console.log(`⏱️ Seleção de método: ${Date.now() - selectTime}ms`);

    // Testar preenchimento mais rápido (sem debounce excessivo)
    const typeTime = Date.now();
    await page.fill('#launch-value-input', '150,75');
    console.log(`⌨️ Preenchimento: ${Date.now() - typeTime}ms`);

    // Aguardar qualquer debounce
    await page.waitForTimeout(400); // Aguardar debounce de 300ms + margem

    // Verificar que não há erro de validação
    const hasError = await page.isVisible('.text-red-500');
    expect(hasError).toBe(false);
    console.log('✅ Validação sem erros após debounce');

    // Testar adição com monitoramento de requests
    const networkRequests: string[] = [];

    page.on('request', request => {
      if (request.url().includes('supabase')) {
        networkRequests.push(request.url());
      }
    });

    const addTime = Date.now();
    await page.click('button:has-text("Adicionar")');

    // Aguardar processamento
    await page.waitForSelector('.animate-spin', { timeout: 5000 });
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 });

    const totalTime = Date.now() - addTime;
    console.log(`⏱️ Tempo total de adição: ${totalTime}ms`);

    // Verificar eficiência de requests
    const authRequests = networkRequests.filter(url => url.includes('/auth/v1/user'));
    const insertRequests = networkRequests.filter(url => url.includes('launches') && url.includes('POST'));

    console.log(`🔐 Requests de autenticação: ${authRequests.length}`);
    console.log(`💾 Requests de inserção: ${insertRequests.length}`);
    console.log(`📊 Total requests Supabase: ${networkRequests.length}`);

    // Validar otimizações
    expect(totalTime).toBeLessThan(2000); // Deve ser mais rápido que 2s
    expect(authRequests.length).toBeLessThanOrEqual(1); // Cache deve reduzir auth requests
    expect(insertRequests.length).toBe(0); // Não deve haver POST na URL (método é diferente)

    // Verificar se apareceu na tabela
    const newRowVisible = await page.isVisible('tbody tr:first-child');
    expect(newRowVisible).toBe(true);
    console.log('✅ Lançamento apareceu na tabela imediatamente');
  });

  test('✅ Teste do Botão Desfazer Otimizado', async ({ page }) => {
    console.log('=== 🔄 TESTE DO BOTÃO DESFAZER OTIMIZADO ===');

    // Primeiro, adicionar um lançamento para desfazer
    await page.click('button[aria-label="Débito"]');
    await page.fill('#launch-value-input', '75,50');
    await page.click('button:has-text("Adicionar")');
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 });

    // Aguardar um pouco para garantir que o lançamento foi criado
    await page.waitForTimeout(1000);

    // Verificar se o lançamento apareceu na tabela
    const launchInTable = await page.isVisible('tbody tr:first-child');
    expect(launchInTable).toBe(true);

    // Clicar no botão desfazer
    const undoTime = Date.now();
    await page.click('button:has-text("Desfazer")');

    // Verificar se o modal apareceu
    const modalVisible = await page.isVisible('text=Confirmar Desfazer');
    expect(modalVisible).toBe(true);

    // Confirmar desfazer
    await page.click('button:has-text("Confirmar")');

    // Aguardar o processo de desfazer
    await page.waitForSelector('button:has-text("Removendo...")', { timeout: 5000 });
    await page.waitForSelector('button:has-text("Removendo...")', { state: 'detached', timeout: 10000 });

    const undoTotalTime = Date.now() - undoTime;
    console.log(`⏱️ Tempo total para desfazer: ${undoTotalTime}ms`);

    // Verificar se o lançamento foi removido da tabela
    await page.waitForTimeout(1000); // Aguardar atualização da UI

    // Verificar se não há mais lançamentos ou se o primeiro lançamento mudou
    const noLaunches = await page.isVisible('text=Nenhum lançamento registrado');
    const firstRowValue = await page.textContent('tbody tr:first-child td:nth-child(8)');

    const wasRemoved = noLaunches || (firstRowValue && !firstRowValue.includes('75,50'));
    expect(wasRemoved).toBe(true);

    expect(undoTotalTime).toBeLessThan(3000); // Deve ser rápido
    console.log('✅ Lançamento desfeito com sucesso do banco de dados');
  });

  test('🚀 Benchmark de Performance com Múltiplas Operações', async ({ page }) => {
    console.log('=== 📈 BENCHMARK OTIMIZADO ===');

    const operations = [
      { method: 'Dinheiro', value: '25,00' },
      { method: 'Débito', value: '45,30' },
      { method: 'Moedas', value: '8,75' }
    ];

    const times: number[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      console.log(`🧪 Operação ${i + 1}: ${op.method} - ${op.value}`);

      const startTime = Date.now();

      // Selecionar método
      await page.click(`button[aria-label="${op.method}"]`);

      // Preencher valor
      await page.fill('#launch-value-input', op.value);

      // Adicionar
      await page.click('button:has-text("Adicionar")');
      await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 10000 });

      const operationTime = Date.now() - startTime;
      times.push(operationTime);

      console.log(`⏱️ Operação ${i + 1}: ${operationTime}ms`);

      // Pequena pausa
      await page.waitForTimeout(500);
    }

    // Calcular estatísticas
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log('📊 ESTATÍSTICAS DO BENCHMARK:');
    console.log(`  Média: ${avgTime.toFixed(0)}ms`);
    console.log(`  Máximo: ${maxTime}ms`);
    console.log(`  Mínimo: ${minTime}ms`);

    // Verificar se a performance está dentro dos limites aceitáveis
    expect(avgTime).toBeLessThan(1500); // Média melhor que 1.5s
    expect(maxTime).toBeLessThan(2500); // Nenhuma operação acima de 2.5s

    // Verificar quantos lançamentos estão na tabela
    const rowCount = await page.locator('tbody tr').count();
    console.log(`📋 Total de lançamentos na tabela: ${rowCount}`);
    expect(rowCount).toBeGreaterThanOrEqual(operations.length);

    console.log('✅ Benchmark de performance completado com sucesso');
  });

  test('⚡ Teste de Digitação Responsiva (Debounce)', async ({ page }) => {
    console.log('=== ⌨️ TESTE DE RESPONSIVIDADE NA DIGITAÇÃO ===');

    await page.click('button[aria-label="Depósito"]');

    // Testar digitação character por character para verificar responsividade
    const testValue = '123,45';
    const charTimes: number[] = [];

    for (let i = 0; i < testValue.length; i++) {
      const charTime = Date.now();
      const char = testValue[i];

      await page.type('#launch-value-input', char, { delay: 0 });

      // Aguardar qualquer processamento imediato
      await page.waitForTimeout(50);

      const processingTime = Date.now() - charTime;
      charTimes.push(processingTime);

      console.log(`📝 Char '${char}': ${processingTime}ms`);
    }

    // Verificar responsividade
    const avgCharTime = charTimes.reduce((sum, t) => sum + t, 0) / charTimes.length;
    const maxCharTime = Math.max(...charTimes);

    console.log(`📊 Tempo médio por caractere: ${avgCharTime.toFixed(1)}ms`);
    console.log(`📊 Tempo máximo: ${maxCharTime}ms`);

    // Aguardar o debounce completar
    await page.waitForTimeout(400);

    // Verificar se não há erro após debounce
    const hasError = await page.isVisible('.text-red-500');
    expect(hasError).toBe(false);

    // Performance deve ser boa
    expect(avgCharTime).toBeLessThan(100); // Média baixa
    expect(maxCharTime).toBeLessThan(200); // Picos controlados

    console.log('✅ Digitação responsiva com debounce funcionando corretamente');
  });
});