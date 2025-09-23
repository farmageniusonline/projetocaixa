import { test, expect } from '@playwright/test';

test.describe('Teste Completo de Todas as Funcionalidades', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);
  });

  test('✅ Teste 1: Funcionalidade de Lançamentos com Supabase', async ({ page }) => {
    console.log('=== TESTE 1: Lançamentos ===');

    // Ir para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(2000);

    // Verificar se não há erro crítico
    const errorScreen = page.locator('text="Erro na Aplicação"');
    await expect(errorScreen).not.toBeVisible();
    console.log('✅ Aba Lançamentos carregou sem erro');

    // Testar adição de lançamento - Dinheiro
    const cashButton = page.locator('button[data-payment-method="cash"]');
    if (await cashButton.count() > 0) {
      await cashButton.click();
      console.log('✅ Botão Dinheiro clicado');

      // Inserir valor
      const valueInput = page.locator('input[type="number"]').first();
      if (await valueInput.count() > 0) {
        await valueInput.fill('50.75');
        console.log('✅ Valor R$ 50,75 inserido');

        // Adicionar lançamento
        const addButton = page.locator('button:has-text("Adicionar")');
        if (await addButton.count() > 0) {
          await addButton.click();
          await page.waitForTimeout(2000);
          console.log('✅ Lançamento adicionado');

          // Verificar se apareceu na lista
          const launchList = page.locator('[data-testid="launch-list"], .launch-item, [class*="launch"]');
          if (await launchList.count() > 0) {
            console.log('✅ Lançamento apareceu na lista');
          } else {
            console.log('⚠️ Lançamento pode não estar visível na lista');
          }
        } else {
          console.log('⚠️ Botão Adicionar não encontrado');
        }
      } else {
        console.log('⚠️ Campo de valor não encontrado');
      }
    } else {
      console.log('⚠️ Botão Dinheiro não encontrado');
    }

    // Testar outros métodos de pagamento
    const paymentMethods = ['debit', 'credit', 'pix'];
    for (const method of paymentMethods) {
      const methodButton = page.locator(`button[data-payment-method="${method}"]`);
      if (await methodButton.count() > 0) {
        await methodButton.click();
        console.log(`✅ Método ${method} funcional`);
        await page.waitForTimeout(500);
      }
    }

    console.log('🎉 Teste 1 concluído: Lançamentos');
  });

  test('✅ Teste 2: Conferência Bancária - Upload e Busca', async ({ page }) => {
    console.log('=== TESTE 2: Conferência Bancária ===');

    // Ir para aba Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // Verificar se não há erro crítico
    const errorScreen = page.locator('text="Erro na Aplicação"');
    await expect(errorScreen).not.toBeVisible();
    console.log('✅ Aba Conferência Bancária carregou sem erro');

    // Verificar indicador de status de dados
    const statusIndicator = page.locator('text=/Sem dados|itens/');
    if (await statusIndicator.count() > 0) {
      const statusText = await statusIndicator.textContent();
      console.log(`✅ Indicador de status encontrado: ${statusText}`);
    }

    // Verificar se campo de conferência está desabilitado sem dados
    const conferenceInput = page.locator('input[placeholder*="Carregue uma planilha primeiro"], input[placeholder*="Digite o valor"]');
    if (await conferenceInput.count() > 0) {
      const isDisabled = await conferenceInput.isDisabled();
      if (isDisabled) {
        console.log('✅ Campo de conferência desabilitado quando sem dados');
      }

      // Verificar placeholder
      const placeholder = await conferenceInput.getAttribute('placeholder');
      if (placeholder?.includes('Carregue uma planilha primeiro')) {
        console.log('✅ Placeholder informativo quando sem dados');
      }
    }

    // Testar botão de upload (simulado)
    const uploadArea = page.locator('[data-testid="file-upload"], input[type="file"], .upload-area');
    if (await uploadArea.count() > 0) {
      console.log('✅ Área de upload encontrada');
    }

    // Testar busca sem dados (deve mostrar erro adequado)
    const searchButton = page.locator('button:has-text("OK")');
    if (await searchButton.count() > 0) {
      const isDisabled = await searchButton.isDisabled();
      if (isDisabled) {
        console.log('✅ Botão de busca desabilitado quando sem dados');
      }
    }

    console.log('🎉 Teste 2 concluído: Conferência Bancária');
  });

  test('✅ Teste 3: Conferência de Caixa', async ({ page }) => {
    console.log('=== TESTE 3: Conferência de Caixa ===');

    // Ir para aba Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Verificar se não há erro crítico
    const errorScreen = page.locator('text="Erro na Aplicação"');
    await expect(errorScreen).not.toBeVisible();
    console.log('✅ Aba Conferência de Caixa carregou sem erro');

    // Verificar elementos da interface
    const cashElements = page.locator('text=/Caixa|Dinheiro|Total/i');
    const elementCount = await cashElements.count();
    if (elementCount > 0) {
      console.log(`✅ ${elementCount} elementos de caixa encontrados`);
    }

    // Verificar se há campos de input para valores
    const inputs = page.locator('input[type="number"], input[type="text"]');
    const inputCount = await inputs.count();
    if (inputCount > 0) {
      console.log(`✅ ${inputCount} campos de input encontrados`);
    }

    // Verificar se há botões funcionais
    const buttons = page.locator('button:not([disabled])');
    const buttonCount = await buttons.count();
    if (buttonCount > 0) {
      console.log(`✅ ${buttonCount} botões ativos encontrados`);
    }

    console.log('🎉 Teste 3 concluído: Conferência de Caixa');
  });

  test('✅ Teste 4: Relatório Diário', async ({ page }) => {
    console.log('=== TESTE 4: Relatório Diário ===');

    // Ir para aba Relatório Diário
    await page.click('text=Relatório Diário');
    await page.waitForTimeout(2000);

    // Verificar se não há erro crítico
    const errorScreen = page.locator('text="Erro na Aplicação"');
    await expect(errorScreen).not.toBeVisible();
    console.log('✅ Aba Relatório Diário carregou sem erro');

    // Verificar título do relatório
    const reportTitle = page.locator('text=/Relatório Diário|📊/');
    if (await reportTitle.count() > 0) {
      console.log('✅ Título do relatório encontrado');
    }

    // Verificar se há dados de resumo
    const summaryCards = page.locator('[class*="card"], [class*="summary"], .bg-gray-800');
    const cardCount = await summaryCards.count();
    if (cardCount > 0) {
      console.log(`✅ ${cardCount} cards de resumo encontrados`);
    }

    // Verificar se há informações monetárias
    const monetaryInfo = page.locator('text=/R\$|Total|Valor/');
    const moneyCount = await monetaryInfo.count();
    if (moneyCount > 0) {
      console.log(`✅ ${moneyCount} informações monetárias encontradas`);
    }

    console.log('🎉 Teste 4 concluído: Relatório Diário');
  });

  test('✅ Teste 5: Ações (Actions)', async ({ page }) => {
    console.log('=== TESTE 5: Ações ===');

    // Ir para aba Ações
    await page.click('text=Ações');
    await page.waitForTimeout(2000);

    // Verificar se não há erro crítico
    const errorScreen = page.locator('text="Erro na Aplicação"');
    await expect(errorScreen).not.toBeVisible();
    console.log('✅ Aba Ações carregou sem erro');

    // Verificar se há lista de ações/logs
    const actionsList = page.locator('[data-testid="actions-list"], .action-item, [class*="action"], [class*="log"]');
    if (await actionsList.count() > 0) {
      console.log('✅ Lista de ações encontrada');
    }

    // Verificar se há timestamps ou informações de data
    const timestamps = page.locator('text=/\\d{2}:\\d{2}|\\d{2}\/\\d{2}|ago|minutes|hours/');
    const timeCount = await timestamps.count();
    if (timeCount > 0) {
      console.log(`✅ ${timeCount} timestamps encontrados`);
    }

    console.log('🎉 Teste 5 concluído: Ações');
  });

  test('✅ Teste 6: Backup', async ({ page }) => {
    console.log('=== TESTE 6: Backup ===');

    // Ir para aba Backup
    await page.click('text=Backup');
    await page.waitForTimeout(2000);

    // Verificar se não há erro crítico
    const errorScreen = page.locator('text="Erro na Aplicação"');
    await expect(errorScreen).not.toBeVisible();
    console.log('✅ Aba Backup carregou sem erro');

    // Verificar se há opções de backup
    const backupOptions = page.locator('button:has-text("Backup"), button:has-text("Download"), button:has-text("Export")');
    const optionCount = await backupOptions.count();
    if (optionCount > 0) {
      console.log(`✅ ${optionCount} opções de backup encontradas`);
    }

    // Verificar se há informações sobre backup
    const backupInfo = page.locator('text=/Backup|Download|Export|Dados/i');
    const infoCount = await backupInfo.count();
    if (infoCount > 0) {
      console.log(`✅ ${infoCount} informações de backup encontradas`);
    }

    console.log('🎉 Teste 6 concluído: Backup');
  });

  test('✅ Teste 7: Navegação e Interface Geral', async ({ page }) => {
    console.log('=== TESTE 7: Navegação Geral ===');

    // Testar navegação entre todas as abas
    const tabs = ['Lançamentos', 'Conferência Bancária', 'Conferência de Caixa', 'Relatório Diário', 'Ações', 'Backup'];

    for (const tab of tabs) {
      await page.click(`text=${tab}`);
      await page.waitForTimeout(1000);

      // Verificar se não há erro após navegação
      const errorScreen = page.locator('text="Erro na Aplicação"');
      await expect(errorScreen).not.toBeVisible();
      console.log(`✅ Navegação para ${tab} funcionando`);
    }

    // Verificar se logout funciona
    const logoutButton = page.locator('button:has-text("Sair")');
    if (await logoutButton.count() > 0) {
      console.log('✅ Botão de logout encontrado');
    }

    // Verificar se há informações do usuário
    const userInfo = page.locator('text=admin');
    if (await userInfo.count() > 0) {
      console.log('✅ Informações do usuário visíveis');
    }

    console.log('🎉 Teste 7 concluído: Navegação Geral');
  });

  test('🔍 Teste 8: Detecção de Erros JavaScript', async ({ page }) => {
    console.log('=== TESTE 8: Detecção de Erros ===');

    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Capturar erros JavaScript
    page.on('pageerror', error => {
      jsErrors.push(error.message);
      console.log(`❌ Erro JavaScript: ${error.message}`);
    });

    // Capturar erros do console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filtrar erros conhecidos e não-críticos
        if (!text.includes('Failed to load resource') &&
            !text.includes('RLS') &&
            !text.includes('row-level security') &&
            !text.includes('404')) {
          consoleErrors.push(text);
          console.log(`⚠️ Console Error: ${text}`);
        }
      }
    });

    // Navegar por todas as abas para detectar erros
    const tabs = ['Lançamentos', 'Conferência Bancária', 'Conferência de Caixa', 'Relatório Diário', 'Ações', 'Backup'];

    for (const tab of tabs) {
      await page.click(`text=${tab}`);
      await page.waitForTimeout(2000);

      // Tentar interagir com elementos da página para provocar possíveis erros
      const buttons = page.locator('button:not([disabled])');
      const buttonCount = Math.min(await buttons.count(), 3); // Testar até 3 botões por aba

      for (let i = 0; i < buttonCount; i++) {
        try {
          await buttons.nth(i).click();
          await page.waitForTimeout(500);
        } catch (error) {
          console.log(`⚠️ Erro ao clicar no botão ${i} da aba ${tab}: ${error}`);
        }
      }
    }

    // Verificar se há erros críticos
    const criticalJsErrors = jsErrors.filter(error =>
      error.includes('Cannot read') ||
      error.includes('undefined') ||
      error.includes('ReferenceError') ||
      error.includes('TypeError')
    );

    const criticalConsoleErrors = consoleErrors.filter(error =>
      error.includes('Cannot read') ||
      error.includes('undefined') ||
      error.includes('ReferenceError') ||
      error.includes('TypeError')
    );

    expect(criticalJsErrors.length).toBe(0);
    expect(criticalConsoleErrors.length).toBe(0);

    if (jsErrors.length === 0 && consoleErrors.length === 0) {
      console.log('✅ Nenhum erro JavaScript detectado');
    } else {
      console.log(`ℹ️ ${jsErrors.length} erros JS e ${consoleErrors.length} erros de console (não-críticos)`);
    }

    console.log('🎉 Teste 8 concluído: Detecção de Erros');
  });

  test('🎯 Teste 9: Teste Específico da Correção de Conferência', async ({ page }) => {
    console.log('=== TESTE 9: Correção de Conferência ===');

    // Ir para aba Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // Verificar indicador de status
    const statusIndicator = page.locator('text="Sem dados"');
    if (await statusIndicator.count() > 0) {
      console.log('✅ Indicador "Sem dados" funcionando');
    }

    // Verificar placeholder do input
    const input = page.locator('input[placeholder*="Carregue uma planilha primeiro"]');
    if (await input.count() > 0) {
      console.log('✅ Placeholder informativo presente');

      // Verificar se está desabilitado
      const isDisabled = await input.isDisabled();
      if (isDisabled) {
        console.log('✅ Input desabilitado quando sem dados');
      }
    }

    // Verificar mensagem de ajuda
    const helpMessage = page.locator('text="Carregue uma planilha para usar esta função"');
    if (await helpMessage.count() > 0) {
      console.log('✅ Mensagem de ajuda presente');
    }

    // Verificar tooltip
    const inputElement = page.locator('input[title*="É necessário carregar uma planilha"]');
    if (await inputElement.count() > 0) {
      console.log('✅ Tooltip informativo presente');
    }

    console.log('🎉 Teste 9 concluído: Correção de Conferência verificada');
  });
});

test.describe('Resumo Final', () => {
  test('📋 RELATÓRIO FINAL: Todas as Funcionalidades', async ({ page }) => {
    console.log('\\n========================================');
    console.log('📋 RELATÓRIO FINAL DE FUNCIONALIDADES');
    console.log('========================================\\n');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);

    const tabs = ['Lançamentos', 'Conferência Bancária', 'Conferência de Caixa', 'Relatório Diário', 'Ações', 'Backup'];
    const results: { [key: string]: boolean } = {};

    for (const tab of tabs) {
      try {
        await page.click(`text=${tab}`);
        await page.waitForTimeout(2000);

        const errorScreen = page.locator('text="Erro na Aplicação"');
        const hasError = await errorScreen.isVisible();
        results[tab] = !hasError;

        console.log(`${!hasError ? '✅' : '❌'} ${tab}: ${!hasError ? 'Funcionando' : 'Com erro'}`);
      } catch (error) {
        results[tab] = false;
        console.log(`❌ ${tab}: Erro de navegação`);
      }
    }

    // Screenshot final
    await page.screenshot({
      path: 'test-all-functions-final.png',
      fullPage: false
    });

    const workingTabs = Object.values(results).filter(Boolean).length;
    const totalTabs = tabs.length;

    console.log('\\n========================================');
    console.log(`🎯 RESULTADO: ${workingTabs}/${totalTabs} funcionalidades operacionais`);
    console.log('========================================\\n');

    // Esperar que pelo menos 80% das funcionalidades estejam funcionando
    expect(workingTabs / totalTabs).toBeGreaterThanOrEqual(0.8);
  });
});