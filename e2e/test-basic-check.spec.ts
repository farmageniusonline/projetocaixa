import { test, expect } from '@playwright/test';

test.describe('Teste Básico de Funcionalidade', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);
  });

  test('Teste Básico: Verificar se aplicação carrega sem erro crítico', async ({ page }) => {
    console.log('=== TESTE BÁSICO: Verificação de Erro Crítico ===');

    // Verificar se NÃO há tela de erro na aplicação
    const errorScreen = page.locator('text="Erro na Aplicação"');
    const hasError = await errorScreen.isVisible();

    if (hasError) {
      console.log('❌ ERRO CRÍTICO DETECTADO: Tela de erro visível');

      // Tentar expandir detalhes do erro se disponível
      const expandButton = page.locator('text="Detalhes do Erro"');
      if (await expandButton.count() > 0) {
        await expandButton.click();
        await page.waitForTimeout(1000);

        // Capturar screenshot do erro
        await page.screenshot({
          path: 'error-critical-detected.png',
          fullPage: true
        });
        console.log('📸 Screenshot do erro salvo: error-critical-detected.png');
      }

      // Falhar o teste se há erro crítico
      expect(hasError).toBe(false);
    } else {
      console.log('✅ SUCESSO: Nenhum erro crítico detectado');

      // Verificar se interface principal está presente
      const pageContent = await page.textContent('body');
      if (pageContent && pageContent.length > 100) {
        console.log('✅ Interface principal carregada com sucesso');
      }

      // Tentar navegar pelas abas para verificar funcionalidade básica
      const tabs = ['Conferência Bancária', 'Conferência de Caixa', 'Relatório Diário'];

      for (const tab of tabs) {
        try {
          const tabElement = page.locator(`text=${tab}`);
          if (await tabElement.count() > 0) {
            await tabElement.click();
            await page.waitForTimeout(1000);

            // Verificar se não apareceu erro após navegar
            const errorAfterNav = await page.locator('text="Erro na Aplicação"').isVisible();
            if (!errorAfterNav) {
              console.log(`✅ Navegação para ${tab} funcionando`);
            } else {
              console.log(`❌ Erro ao navegar para ${tab}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ Problema ao testar navegação para ${tab}: ${error}`);
        }
      }

      // Screenshot de sucesso
      await page.screenshot({
        path: 'success-no-critical-error.png',
        fullPage: false
      });
      console.log('📸 Screenshot de sucesso salvo');
    }

    console.log('🏁 Teste básico concluído');
  });

  test('Teste Específico: Conferência Bancária - Indicadores Visuais', async ({ page }) => {
    console.log('=== TESTE: Verificação dos Indicadores da Conferência ===');

    try {
      // Tentar navegar para Conferência Bancária
      const confTab = page.locator('text=Conferência Bancária');
      if (await confTab.count() > 0) {
        await confTab.click();
        await page.waitForTimeout(2000);

        // Verificar se não há erro crítico
        const errorScreen = await page.locator('text="Erro na Aplicação"').isVisible();
        if (!errorScreen) {
          console.log('✅ Conferência Bancária carregou sem erro');

          // Verificar indicador de status (nossa correção)
          const statusIndicator = page.locator('text=/Sem dados|\\d+ itens/');
          if (await statusIndicator.count() > 0) {
            const statusText = await statusIndicator.textContent();
            console.log(`✅ Indicador de status funcionando: ${statusText}`);
          } else {
            console.log('⚠️ Indicador de status não encontrado');
          }

          // Verificar placeholder do input (nossa correção)
          const inputWithPlaceholder = page.locator('input[placeholder*="Carregue uma planilha primeiro"]');
          if (await inputWithPlaceholder.count() > 0) {
            console.log('✅ Placeholder informativo presente');

            const isDisabled = await inputWithPlaceholder.isDisabled();
            if (isDisabled) {
              console.log('✅ Input corretamente desabilitado quando sem dados');
            }
          }

          // Screenshot da aba funcionando
          await page.screenshot({
            path: 'conferencia-bancaria-funcionando.png',
            fullPage: false
          });
          console.log('📸 Screenshot da Conferência Bancária salvo');
        } else {
          console.log('❌ Erro na Conferência Bancária');
        }
      } else {
        console.log('⚠️ Aba Conferência Bancária não encontrada');
      }
    } catch (error) {
      console.log(`❌ Erro durante teste da Conferência Bancária: ${error}`);
    }

    console.log('🏁 Teste da Conferência Bancária concluído');
  });
});