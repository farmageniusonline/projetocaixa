import { test, expect } from '@playwright/test';

test.describe('Investigação do Erro na Aba Lançamentos', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);
  });

  test('Investigar erro específico na aba Lançamentos', async ({ page }) => {
    console.log('=== INVESTIGAÇÃO: Erro na Aba Lançamentos ===');

    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Capturar erros JavaScript
    page.on('pageerror', error => {
      jsErrors.push(error.message);
      console.log(`❌ Erro JavaScript: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    });

    // Capturar erros do console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        console.log(`⚠️ Console Error: ${text}`);
      }
    });

    // Verificar se há erro logo após o login
    let hasInitialError = await page.locator('text="Erro na Aplicação"').isVisible();
    if (hasInitialError) {
      console.log('❌ Erro já presente logo após login');
    } else {
      console.log('✅ Nenhum erro inicial detectado');
    }

    // Tentar navegar para Lançamentos
    console.log('🔍 Tentando navegar para aba Lançamentos...');

    try {
      const launchTab = page.locator('text=Lançamentos');
      const tabExists = await launchTab.count();

      if (tabExists > 0) {
        console.log('✅ Aba Lançamentos encontrada');

        // Clicar na aba
        await launchTab.click();
        console.log('🖱️ Clicou na aba Lançamentos');

        // Aguardar um pouco para ver se erro aparece
        await page.waitForTimeout(2000);

        // Verificar se apareceu erro
        const errorAfterClick = await page.locator('text="Erro na Aplicação"').isVisible();

        if (errorAfterClick) {
          console.log('❌ ERRO DETECTADO após clicar em Lançamentos');

          // Tentar expandir detalhes do erro
          const expandButton = page.locator('text="Detalhes do Erro"');
          if (await expandButton.count() > 0) {
            console.log('🔍 Expandindo detalhes do erro...');
            await expandButton.click();
            await page.waitForTimeout(1000);

            // Capturar detalhes do erro
            const errorDetails = await page.locator('[class*="error"], [class*="stack"], pre, code').allTextContents();

            console.log('📋 DETALHES DO ERRO:');
            errorDetails.forEach((detail, index) => {
              if (detail.trim()) {
                console.log(`${index + 1}. ${detail.trim()}`);
              }
            });

            // Screenshot dos detalhes
            await page.screenshot({
              path: 'error-details-investigation.png',
              fullPage: true
            });
            console.log('📸 Screenshot dos detalhes do erro salvo');
          }
        } else {
          console.log('✅ Nenhum erro detectado após navegar para Lançamentos');
        }

      } else {
        console.log('❌ Aba Lançamentos não encontrada');
      }

    } catch (error) {
      console.log(`❌ Erro durante navegação: ${error}`);
    }

    // Relatório final de erros
    console.log('\\n📊 RELATÓRIO DE ERROS:');
    console.log(`JavaScript Errors: ${jsErrors.length}`);
    jsErrors.forEach((err, index) => {
      console.log(`  ${index + 1}. ${err}`);
    });

    console.log(`Console Errors: ${consoleErrors.length}`);
    consoleErrors.forEach((err, index) => {
      console.log(`  ${index + 1}. ${err}`);
    });

    // Screenshot final
    await page.screenshot({
      path: 'final-state-investigation.png',
      fullPage: false
    });

    console.log('🏁 Investigação concluída');
  });

  test('Testar navegação direta via URL', async ({ page }) => {
    console.log('=== TESTE: Navegação Direta via URL ===');

    // Tentar ir diretamente para a URL com hash de lançamentos
    await page.goto('http://localhost:5175/#lancamentos');
    await page.waitForTimeout(3000);

    const hasError = await page.locator('text="Erro na Aplicação"').isVisible();

    if (hasError) {
      console.log('❌ Erro também aparece na navegação direta via URL');
    } else {
      console.log('✅ Navegação direta via URL funcionou');
    }

    await page.screenshot({
      path: 'direct-navigation-test.png',
      fullPage: false
    });

    console.log('🏁 Teste de navegação direta concluído');
  });
});