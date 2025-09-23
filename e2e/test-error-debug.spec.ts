import { test, expect } from '@playwright/test';

test('Debug - Capturar erros específicos da aplicação', async ({ page }) => {
  // Capturar todos os logs do console
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);

    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.log(`🚨 Console Error: ${msg.text()}`);
    }
  });

  // Capturar erros de página
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('=== DEBUG: Investigando erro da aplicação ===');

  try {
    // Navegar para a aplicação
    await page.goto('http://localhost:5175');
    console.log('✅ Navegou para a aplicação');

    // Aguardar um pouco para ver se há erros imediatos
    await page.waitForTimeout(2000);

    // Verificar se a tela de login está presente
    const loginForm = page.locator('[data-testid="username-input"]');

    if (await loginForm.count() > 0) {
      console.log('✅ Tela de login encontrada, tentando fazer login...');

      // Fazer login
      await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
      await page.fill('[data-testid="password-input"]', 'manipularium');
      await page.click('[data-testid="login-button"]');

      console.log('✅ Credenciais inseridas, aguardando resposta...');

      // Aguardar o login processar
      await page.waitForTimeout(5000);

      // Verificar se apareceu a tela de erro
      const errorScreen = page.locator('text="Erro na Aplicação"');

      if (await errorScreen.count() > 0) {
        console.log('❌ Tela de erro detectada após login');

        // Tentar expandir detalhes do erro
        const errorDetails = page.locator('text="Detalhes do Erro"');
        if (await errorDetails.count() > 0) {
          await errorDetails.click();
          await page.waitForTimeout(1000);
          console.log('🔍 Tentou expandir detalhes do erro');
        }

        // Capturar todo o texto da página de erro
        const errorContent = await page.textContent('body');
        console.log('📋 Conteúdo da página de erro:');
        console.log(errorContent);

      } else {
        // Verificar se conseguiu entrar na aplicação
        const appContent = page.locator('text="Lançamentos"');
        if (await appContent.count() > 0) {
          console.log('✅ Login bem-sucedido, aba Lançamentos encontrada');
        } else {
          console.log('⚠️ Login processado mas estado da aplicação é desconhecido');
        }
      }

    } else {
      console.log('❌ Tela de login não encontrada');

      // Verificar se já está na tela de erro
      const errorScreen = page.locator('text="Erro na Aplicação"');
      if (await errorScreen.count() > 0) {
        console.log('❌ Aplicação já iniciou com erro');
      }
    }

  } catch (error) {
    console.log('💥 Erro durante execução do teste:', error);
  }

  // Imprimir todos os logs coletados
  console.log('\n=== LOGS DO CONSOLE ===');
  consoleLogs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });

  if (consoleErrors.length > 0) {
    console.log('\n=== ERROS ESPECÍFICOS ===');
    consoleErrors.forEach((error, index) => {
      console.log(`ERROR ${index + 1}: ${error}`);
    });
  }

  // Screenshot final
  await page.screenshot({
    path: 'error-debug-final.png',
    fullPage: true
  });

  console.log('📸 Screenshot final salvo: error-debug-final.png');
  console.log('🏁 Debug de erro concluído');
});