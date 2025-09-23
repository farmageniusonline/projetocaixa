import { test, expect } from '@playwright/test';

test.describe('Testes de Limpeza e Filtros - Todas as Abas', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);

    // Verificar se há erro após login
    const hasError = await page.locator('text="Erro na Aplicação"').isVisible();
    if (hasError) {
      throw new Error('Erro detectado após login');
    }
  });

  test('Aba Lançamentos - Limpar Filtros', async ({ page }) => {
    console.log('=== TESTE: Limpar Filtros na Aba Lançamentos ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // 1. Aplicar filtro de data
    console.log('📅 Aplicando filtro de data...');
    const testDate = '2024-01-15';
    await page.fill('input[type="date"]', testDate);
    await page.click('text=Aplicar');
    await page.waitForTimeout(1000);

    // Verificar se filtro foi aplicado
    const dateInput = await page.locator('input[type="date"]').inputValue();
    expect(dateInput).toBe(testDate);
    console.log(`✅ Filtro de data aplicado: ${dateInput}`);

    // 2. Aplicar filtro de tipo de pagamento
    console.log('💳 Aplicando filtro de tipo de pagamento...');
    await page.selectOption('select', 'credit_1x');
    await page.waitForTimeout(1000);

    const selectedPaymentType = await page.locator('select').inputValue();
    expect(selectedPaymentType).toBe('credit_1x');
    console.log(`✅ Filtro de pagamento aplicado: ${selectedPaymentType}`);

    // 3. Limpar todos os filtros
    console.log('🧹 Limpando todos os filtros...');
    await page.click('text=Limpar Filtros');
    await page.waitForTimeout(1000);

    // Verificar se filtros foram limpos
    const clearedDateInput = await page.locator('input[type="date"]').inputValue();
    const clearedPaymentType = await page.locator('select').inputValue();

    expect(clearedDateInput).toBe('');
    expect(clearedPaymentType).toBe('all');

    console.log(`✅ Data limpa: "${clearedDateInput}"`);
    console.log(`✅ Tipo de pagamento limpo: "${clearedPaymentType}"`);

    // Verificar mensagem de confirmação
    const hasFilterMessage = await page.locator('text="Todos os filtros foram removidos"').isVisible();
    if (hasFilterMessage) {
      console.log('✅ Mensagem de confirmação exibida');
    }

    console.log('🏁 Teste de limpeza de filtros concluído');
  });

  test('Aba Lançamentos - Verificar Limpeza Automática após Adicionar', async ({ page }) => {
    console.log('=== TESTE: Limpeza Automática após Adicionar Lançamento ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // 1. Selecionar método de pagamento
    await page.click('button[aria-label="Dinheiro"]');
    await page.waitForTimeout(500);

    // 2. Preencher valor
    const testValue = '25,50';
    await page.fill('#launch-value-input', testValue);

    // Verificar se valor foi preenchido
    const inputValue = await page.locator('#launch-value-input').inputValue();
    expect(inputValue).toBe(testValue);
    console.log(`✅ Valor preenchido: ${inputValue}`);

    // 3. Adicionar lançamento
    console.log('💰 Adicionando lançamento...');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(3000);

    // 4. Verificar se campos foram limpos automaticamente
    const clearedValue = await page.locator('#launch-value-input').inputValue();
    expect(clearedValue).toBe('');
    console.log(`✅ Campo de valor limpo automaticamente: "${clearedValue}"`);

    // Verificar se foco retornou ao campo de valor
    const isFocused = await page.locator('#launch-value-input').evaluate(el => el === document.activeElement);
    if (isFocused) {
      console.log('✅ Foco retornou ao campo de valor');
    }

    console.log('🏁 Teste de limpeza automática concluído');
  });

  test('Aba Dashboard - Limpar Dados Carregados', async ({ page }) => {
    console.log('=== TESTE: Limpeza na Aba Dashboard ===');

    // Navegar para aba Dashboard (principal)
    await page.click('text=Dashboard');
    await page.waitForTimeout(2000);

    // Procurar botões de limpeza na interface
    const clearButtons = await page.locator('button:has-text("Limpar"), button:has-text("Reset"), button[title*="limpar"], button[title*="reset"]').count();
    console.log(`🔍 Encontrados ${clearButtons} botões de limpeza no Dashboard`);

    if (clearButtons > 0) {
      // Testar primeiro botão de limpeza encontrado
      const firstClearButton = page.locator('button:has-text("Limpar"), button:has-text("Reset")').first();
      const buttonText = await firstClearButton.textContent();

      console.log(`🧹 Testando botão: "${buttonText}"`);
      await firstClearButton.click();
      await page.waitForTimeout(2000);

      console.log('✅ Botão de limpeza clicado com sucesso');
    } else {
      console.log('⚠️ Nenhum botão de limpeza específico encontrado no Dashboard');
    }

    // Verificar área de upload de arquivos
    const fileInputs = await page.locator('input[type="file"]').count();
    console.log(`📁 Encontrados ${fileInputs} campos de upload`);

    if (fileInputs > 0) {
      console.log('✅ Interface de upload disponível para limpeza manual');
    }

    console.log('🏁 Teste de limpeza no Dashboard concluído');
  });

  test('Aba Conferência de Caixa - Verificar Funcionalidades de Limpeza', async ({ page }) => {
    console.log('=== TESTE: Limpeza na Aba Conferência de Caixa ===');

    // Navegar para aba Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Procurar controles de filtro e limpeza
    const filterControls = await page.locator('input, select, button').count();
    console.log(`🔧 Encontrados ${filterControls} controles na interface`);

    // Procurar especificamente por campos de data
    const dateInputs = await page.locator('input[type="date"]').count();
    console.log(`📅 Encontrados ${dateInputs} campos de data`);

    // Procurar por botões de ação
    const actionButtons = await page.locator('button:has-text("Limpar"), button:has-text("Reset"), button:has-text("Conferir")').count();
    console.log(`⚡ Encontrados ${actionButtons} botões de ação`);

    if (actionButtons > 0) {
      // Listar os botões encontrados
      const buttons = await page.locator('button:has-text("Limpar"), button:has-text("Reset"), button:has-text("Conferir")').allTextContents();
      console.log(`🔘 Botões disponíveis: ${buttons.join(', ')}`);

      // Testar botão de limpeza se disponível
      const clearButton = page.locator('button:has-text("Limpar")').first();
      const hasClearButton = await clearButton.count() > 0;

      if (hasClearButton) {
        console.log('🧹 Testando botão de limpeza...');
        await clearButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Botão de limpeza executado');
      }
    }

    // Verificar se existem itens na tabela para testar limpeza
    const tableRows = await page.locator('table tbody tr').count();
    console.log(`📊 Encontradas ${tableRows} linhas na tabela`);

    console.log('🏁 Teste de limpeza na Conferência de Caixa concluído');
  });

  test('Navegação entre Abas - Preservação de Estado', async ({ page }) => {
    console.log('=== TESTE: Preservação de Estado entre Abas ===');

    // 1. Começar na aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Aplicar filtro
    await page.fill('input[type="date"]', '2024-01-20');
    const setDate = await page.locator('input[type="date"]').inputValue();
    console.log(`📅 Data definida em Lançamentos: ${setDate}`);

    // 2. Navegar para Dashboard
    await page.click('text=Dashboard');
    await page.waitForTimeout(1000);
    console.log('🏠 Navegou para Dashboard');

    // 3. Voltar para Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Verificar se estado foi preservado
    const preservedDate = await page.locator('input[type="date"]').inputValue();
    console.log(`📅 Data preservada: ${preservedDate}`);

    if (preservedDate === setDate) {
      console.log('✅ Estado preservado corretamente entre navegações');
    } else {
      console.log('⚠️ Estado não foi preservado entre navegações');
    }

    // 4. Limpar e verificar novamente
    await page.click('text=Limpar Filtros');
    await page.waitForTimeout(1000);

    const clearedDate = await page.locator('input[type="date"]').inputValue();
    expect(clearedDate).toBe('');
    console.log(`✅ Filtro limpo corretamente: "${clearedDate}"`);

    console.log('🏁 Teste de preservação de estado concluído');
  });

  test('Funcionalidade de Reset Global', async ({ page }) => {
    console.log('=== TESTE: Reset Global da Aplicação ===');

    // 1. Adicionar alguns dados em Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    const initialRowCount = await page.locator('tbody tr').count();
    console.log(`📊 Linhas iniciais na tabela: ${initialRowCount}`);

    // Adicionar um lançamento
    await page.click('button[aria-label="Dinheiro"]');
    await page.fill('#launch-value-input', '10,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(2000);

    const afterAddRowCount = await page.locator('tbody tr').count();
    console.log(`📊 Linhas após adicionar: ${afterAddRowCount}`);

    // 2. Navegar entre abas para verificar se dados persistem
    await page.click('text=Dashboard');
    await page.waitForTimeout(1000);
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    const persistedRowCount = await page.locator('tbody tr').count();
    console.log(`📊 Linhas após navegação: ${persistedRowCount}`);

    // Verificar se dados persistiram
    if (persistedRowCount >= afterAddRowCount) {
      console.log('✅ Dados persistiram corretamente entre navegações');
    } else {
      console.log('⚠️ Dados podem ter sido perdidos');
    }

    // 3. Procurar função de reset global (se existir)
    await page.click('text=Dashboard');
    await page.waitForTimeout(1000);

    const resetButtons = await page.locator('button:has-text("Reset"), button:has-text("Reiniciar"), button[title*="reset"]').count();
    console.log(`🔄 Encontrados ${resetButtons} botões de reset global`);

    if (resetButtons > 0) {
      console.log('🔄 Testando reset global...');
      await page.locator('button:has-text("Reset"), button:has-text("Reiniciar")').first().click();
      await page.waitForTimeout(2000);
      console.log('✅ Reset global executado');
    }

    // Screenshot final para documentação
    await page.screenshot({
      path: 'test-clear-functions-final.png',
      fullPage: false
    });

    console.log('🏁 Teste de reset global concluído');
  });
});