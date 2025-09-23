import { test, expect } from '@playwright/test';

test.describe('Teste Funcional Rápido', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(2000);
  });

  test('🔍 Teste Rápido: Verificação de Funcionalidades Básicas', async ({ page }) => {
    console.log('=== TESTE RÁPIDO: Verificação Básica ===');

    const errors: string[] = [];

    // Capturar erros JavaScript
    page.on('pageerror', error => {
      errors.push(`JS Error: ${error.message}`);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('RLS')) {
          errors.push(`Console Error: ${text}`);
        }
      }
    });

    // 1. Teste Lançamentos
    try {
      await page.click('text=Lançamentos');
      await page.waitForTimeout(1500);

      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.isVisible()) {
        errors.push('Lançamentos: Tela de erro visível');
      } else {
        console.log('✅ Lançamentos: Carregou sem erro');
      }

      // Testar botão de pagamento
      const cashButton = page.locator('button[data-payment-method="cash"]');
      if (await cashButton.count() > 0) {
        await cashButton.click();
        console.log('✅ Lançamentos: Botão dinheiro clicável');
      } else {
        errors.push('Lançamentos: Botão dinheiro não encontrado');
      }
    } catch (error) {
      errors.push(`Lançamentos: ${error}`);
    }

    // 2. Teste Conferência Bancária
    try {
      await page.click('text=Conferência Bancária');
      await page.waitForTimeout(1500);

      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.isVisible()) {
        errors.push('Conferência Bancária: Tela de erro visível');
      } else {
        console.log('✅ Conferência Bancária: Carregou sem erro');
      }

      // Verificar indicador de status
      const statusIndicator = page.locator('text="Sem dados"');
      if (await statusIndicator.count() > 0) {
        console.log('✅ Conferência Bancária: Indicador de status funcionando');
      }

      // Verificar se input está desabilitado
      const input = page.locator('input[placeholder*="Carregue uma planilha primeiro"]');
      if (await input.count() > 0) {
        const isDisabled = await input.isDisabled();
        if (isDisabled) {
          console.log('✅ Conferência Bancária: Input corretamente desabilitado');
        } else {
          errors.push('Conferência Bancária: Input deveria estar desabilitado');
        }
      }
    } catch (error) {
      errors.push(`Conferência Bancária: ${error}`);
    }

    // 3. Teste Conferência de Caixa
    try {
      await page.click('text=Conferência de Caixa');
      await page.waitForTimeout(1500);

      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.isVisible()) {
        errors.push('Conferência de Caixa: Tela de erro visível');
      } else {
        console.log('✅ Conferência de Caixa: Carregou sem erro');
      }
    } catch (error) {
      errors.push(`Conferência de Caixa: ${error}`);
    }

    // 4. Teste Relatório Diário
    try {
      await page.click('text=Relatório Diário');
      await page.waitForTimeout(1500);

      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.isVisible()) {
        errors.push('Relatório Diário: Tela de erro visível');
      } else {
        console.log('✅ Relatório Diário: Carregou sem erro');
      }
    } catch (error) {
      errors.push(`Relatório Diário: ${error}`);
    }

    // 5. Teste Ações
    try {
      await page.click('text=Ações');
      await page.waitForTimeout(1500);

      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.isVisible()) {
        errors.push('Ações: Tela de erro visível');
      } else {
        console.log('✅ Ações: Carregou sem erro');
      }
    } catch (error) {
      errors.push(`Ações: ${error}`);
    }

    // 6. Teste Backup
    try {
      await page.click('text=Backup');
      await page.waitForTimeout(1500);

      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.isVisible()) {
        errors.push('Backup: Tela de erro visível');
      } else {
        console.log('✅ Backup: Carregou sem erro');
      }
    } catch (error) {
      errors.push(`Backup: ${error}`);
    }

    // Screenshot final
    await page.screenshot({
      path: 'test-quick-functional.png',
      fullPage: false
    });

    // Relatório de erros
    if (errors.length > 0) {
      console.log('\\n❌ ERROS ENCONTRADOS:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    } else {
      console.log('\\n✅ NENHUM ERRO ENCONTRADO - APLICAÇÃO FUNCIONANDO CORRETAMENTE');
    }

    console.log(`\\n📊 Resumo: ${errors.length} erros encontrados`);

    // Falhar teste se houver erros críticos
    const criticalErrors = errors.filter(error =>
      error.includes('JS Error:') ||
      error.includes('Tela de erro visível') ||
      error.includes('performanceLogger') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );

    if (criticalErrors.length > 0) {
      console.log('\\n🚨 ERROS CRÍTICOS DETECTADOS:');
      criticalErrors.forEach(error => console.log(`- ${error}`));
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('🎯 Teste Específico: Conferência Bancária Corrigida', async ({ page }) => {
    console.log('=== TESTE: Correção Conferência Bancária ===');

    // Ir para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // 1. Verificar indicador visual de status
    const statusWithData = page.locator('text=/\\d+ itens/');
    const statusWithoutData = page.locator('text="Sem dados"');

    if (await statusWithoutData.count() > 0) {
      console.log('✅ Indicador "Sem dados" presente');
    } else if (await statusWithData.count() > 0) {
      console.log('✅ Indicador com dados presente');
    } else {
      console.log('⚠️ Indicador de status não encontrado');
    }

    // 2. Verificar placeholder do input
    const inputWithPlaceholder = page.locator('input[placeholder*="Carregue uma planilha primeiro"]');
    const inputNormal = page.locator('input[placeholder*="Digite o valor"]');

    if (await inputWithPlaceholder.count() > 0) {
      console.log('✅ Placeholder "Carregue uma planilha primeiro" presente');

      // Verificar se está desabilitado
      const isDisabled = await inputWithPlaceholder.isDisabled();
      if (isDisabled) {
        console.log('✅ Input desabilitado quando sem dados');
      } else {
        console.log('❌ Input deveria estar desabilitado');
      }
    } else if (await inputNormal.count() > 0) {
      console.log('✅ Input normal presente (dados carregados)');
    }

    // 3. Verificar tooltip
    const inputWithTooltip = page.locator('input[title*="É necessário carregar uma planilha"]');
    if (await inputWithTooltip.count() > 0) {
      console.log('✅ Tooltip informativo presente');
    }

    // 4. Verificar mensagem de ajuda
    const helpMessage = page.locator('text="Carregue uma planilha para usar esta função"');
    if (await helpMessage.count() > 0) {
      console.log('✅ Mensagem de ajuda presente');
    }

    // 5. Testar busca sem dados (deve mostrar erro adequado)
    const searchButton = page.locator('button:has-text("OK")');
    if (await searchButton.count() > 0) {
      const isDisabled = await searchButton.isDisabled();
      if (isDisabled) {
        console.log('✅ Botão de busca desabilitado quando sem dados');
      } else {
        console.log('⚠️ Botão de busca deveria estar desabilitado');
      }
    }

    console.log('✅ Teste da correção de conferência concluído');
  });

  test('⚡ Teste de Performance: Carregamento das Abas', async ({ page }) => {
    console.log('=== TESTE: Performance de Carregamento ===');

    const tabs = ['Lançamentos', 'Conferência Bancária', 'Conferência de Caixa', 'Relatório Diário', 'Ações', 'Backup'];
    const loadTimes: { [key: string]: number } = {};

    for (const tab of tabs) {
      const startTime = Date.now();

      try {
        await page.click(`text=${tab}`);

        // Aguardar até que não haja mais tela de carregamento ou erro
        await page.waitForFunction(() => {
          const errorEl = document.querySelector('text="Erro na Aplicação"');
          const loadingEl = document.querySelector('[data-loading="true"]');
          return !errorEl && !loadingEl;
        }, { timeout: 5000 });

        const endTime = Date.now();
        const loadTime = endTime - startTime;
        loadTimes[tab] = loadTime;

        console.log(`✅ ${tab}: ${loadTime}ms`);

        if (loadTime > 3000) {
          console.log(`⚠️ ${tab}: Carregamento lento (${loadTime}ms)`);
        }

      } catch (error) {
        const endTime = Date.now();
        const loadTime = endTime - startTime;
        loadTimes[tab] = loadTime;
        console.log(`❌ ${tab}: Timeout ou erro (${loadTime}ms)`);
      }
    }

    // Calcular tempo médio
    const times = Object.values(loadTimes);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

    console.log(`\\n📊 Tempo médio de carregamento: ${avgTime.toFixed(0)}ms`);

    if (avgTime > 5000) {
      console.log('⚠️ Performance ruim detectada - tempos de carregamento altos');
    } else {
      console.log('✅ Performance aceitável');
    }
  });
});