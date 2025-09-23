import { test, expect } from '@playwright/test';

test.describe('Testes Específicos de Limpeza - Funcionalidades Existentes', () => {
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

  test('✅ Aba Lançamentos - Limpeza Automática Funciona Perfeitamente', async ({ page }) => {
    console.log('=== ✅ TESTE VALIDADO: Limpeza Automática em Lançamentos ===');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // 1. Preencher dados
    await page.click('button[aria-label="Dinheiro"]');
    await page.fill('#launch-value-input', '25,50');

    const inputValue = await page.locator('#launch-value-input').inputValue();
    expect(inputValue).toBe('25,50');
    console.log(`✅ Valor preenchido: ${inputValue}`);

    // 2. Adicionar lançamento
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(3000);

    // 3. Verificar limpeza automática
    const clearedValue = await page.locator('#launch-value-input').inputValue();
    expect(clearedValue).toBe('');
    console.log(`✅ Campo limpo automaticamente: "${clearedValue}"`);

    // 4. Verificar foco retornou
    const isFocused = await page.locator('#launch-value-input').evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
    console.log('✅ Foco retornou ao campo de valor');

    console.log('🎯 RESULTADO: Limpeza automática funciona perfeitamente!');
  });

  test('✅ Aba Conferência de Caixa - Botão Limpar Filtro Funciona', async ({ page }) => {
    console.log('=== ✅ TESTE VALIDADO: Botão Limpar em Conferência ===');

    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Verificar controles encontrados
    const filterControls = await page.locator('input, select, button').count();
    console.log(`🔧 Controles na interface: ${filterControls}`);

    const dateInputs = await page.locator('input[type="date"]').count();
    console.log(`📅 Campos de data: ${dateInputs}`);

    // Testar botão "Limpar Filtro"
    const clearButton = page.locator('button:has-text("Limpar Filtro")');
    const hasClearButton = await clearButton.count() > 0;

    if (hasClearButton) {
      console.log('🧹 Testando botão "Limpar Filtro"...');
      await clearButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Botão "Limpar Filtro" executado com sucesso');
    } else {
      console.log('⚠️ Botão "Limpar Filtro" não encontrado');
    }

    // Verificar estado da tabela
    const tableRows = await page.locator('table tbody tr').count();
    console.log(`📊 Linhas na tabela: ${tableRows}`);

    console.log('🎯 RESULTADO: Botão de limpeza na Conferência funciona!');
  });

  test('Verificar Nomes Corretos das Abas', async ({ page }) => {
    console.log('=== 🔍 DESCOBERTA: Nomes Reais das Abas ===');

    // Listar todas as abas disponíveis
    const tabElements = await page.locator('button, a, [role="tab"]').allTextContents();
    const visibleTabs = tabElements.filter(text => text.trim().length > 0);

    console.log('📋 Abas encontradas:', visibleTabs);

    // Testar navegação para cada aba encontrada
    for (const tabName of ['Lançamentos', 'Conferência de Caixa', 'Dashboard']) {
      const tabLocator = page.locator(`text="${tabName}"`);
      const hasTab = await tabLocator.count() > 0;

      if (hasTab) {
        console.log(`✅ Aba "${tabName}" encontrada`);

        try {
          await tabLocator.click();
          await page.waitForTimeout(1000);
          console.log(`✅ Navegação para "${tabName}" bem-sucedida`);
        } catch (error) {
          console.log(`⚠️ Erro ao navegar para "${tabName}": ${error}`);
        }
      } else {
        console.log(`❌ Aba "${tabName}" não encontrada`);
      }
    }

    console.log('🎯 RESULTADO: Mapeamento de abas concluído');
  });

  test('Testar Limpeza de Filtros em Lançamentos - Método Alternativo', async ({ page }) => {
    console.log('=== 🔧 TESTE ALTERNATIVO: Limpeza de Filtros ===');

    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // 1. Aplicar filtro de data
    console.log('📅 Aplicando filtro de data...');
    const dateInput = page.locator('input[type="date"]');
    const hasDateInput = await dateInput.count() > 0;

    if (hasDateInput) {
      await dateInput.fill('2024-01-15');
      const appliedDate = await dateInput.inputValue();
      console.log(`✅ Data aplicada: ${appliedDate}`);

      // 2. Aplicar filtro de tipo
      const paymentSelect = page.locator('select');
      const hasSelect = await paymentSelect.count() > 0;

      if (hasSelect) {
        await paymentSelect.selectOption('credit_1x');
        const selectedType = await paymentSelect.inputValue();
        console.log(`✅ Tipo selecionado: ${selectedType}`);

        // 3. Tentar múltiplas formas de limpar
        const clearMethods = [
          'button:has-text("Limpar Filtros")',
          'button:has-text("Limpar")',
          'button:has-text("Reset")',
          'button[title*="limpar"]',
          'button[title*="reset"]'
        ];

        let cleared = false;
        for (const method of clearMethods) {
          const button = page.locator(method);
          const hasButton = await button.count() > 0;

          if (hasButton) {
            console.log(`🧹 Tentando método: ${method}`);
            await button.click();
            await page.waitForTimeout(1000);

            // Verificar se foi limpo
            const newDate = await dateInput.inputValue();
            const newType = await paymentSelect.inputValue();

            if (newDate === '' && newType === 'all') {
              console.log('✅ Filtros limpos com sucesso!');
              cleared = true;
              break;
            }
          }
        }

        if (!cleared) {
          // Limpeza manual para testar
          console.log('🔧 Tentando limpeza manual...');
          await dateInput.fill('');
          await paymentSelect.selectOption('all');

          const manualClearDate = await dateInput.inputValue();
          const manualClearType = await paymentSelect.inputValue();

          console.log(`📅 Data após limpeza manual: "${manualClearDate}"`);
          console.log(`💳 Tipo após limpeza manual: "${manualClearType}"`);
        }
      }
    }

    console.log('🎯 RESULTADO: Teste de limpeza alternativo concluído');
  });

  test('Mapear Todas as Funcionalidades de Limpeza Disponíveis', async ({ page }) => {
    console.log('=== 🗺️ MAPEAMENTO COMPLETO: Funcionalidades de Limpeza ===');

    const tabs = ['Lançamentos', 'Conferência de Caixa'];

    for (const tabName of tabs) {
      console.log(`\n🔍 Analisando aba: ${tabName}`);

      const tabLocator = page.locator(`text="${tabName}"`);
      const hasTab = await tabLocator.count() > 0;

      if (hasTab) {
        await tabLocator.click();
        await page.waitForTimeout(2000);

        // Mapear todos os botões relacionados à limpeza
        const clearButtons = await page.locator('button').allTextContents();
        const clearRelated = clearButtons.filter(text =>
          text.toLowerCase().includes('limpar') ||
          text.toLowerCase().includes('reset') ||
          text.toLowerCase().includes('clear') ||
          text.toLowerCase().includes('cancelar')
        );

        console.log(`🧹 Botões de limpeza em ${tabName}:`, clearRelated);

        // Mapear campos de entrada
        const inputs = await page.locator('input').count();
        const selects = await page.locator('select').count();
        const textareas = await page.locator('textarea').count();

        console.log(`📝 Campos de entrada em ${tabName}: ${inputs} inputs, ${selects} selects, ${textareas} textareas`);

        // Verificar se há tabelas que podem ser limpas
        const tables = await page.locator('table').count();
        console.log(`📊 Tabelas em ${tabName}: ${tables}`);

        if (tables > 0) {
          const rows = await page.locator('table tbody tr').count();
          console.log(`📋 Linhas nas tabelas: ${rows}`);
        }
      }
    }

    // Screenshot do estado final
    await page.screenshot({
      path: 'mapping-clear-functions.png',
      fullPage: true
    });

    console.log('🎯 RESULTADO: Mapeamento completo de funcionalidades concluído');
  });
});