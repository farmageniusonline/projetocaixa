import { test, expect } from '@playwright/test';

test.describe('Captura Profunda do Erro', () => {
  test('Capturar erro detalhado com stack trace completo', async ({ page }) => {
    console.log('=== CAPTURA PROFUNDA DO ERRO ===');

    const jsErrors: any[] = [];
    const consoleMessages: any[] = [];
    const networkErrors: any[] = [];

    // Capturar TODOS os tipos de erro
    page.on('pageerror', error => {
      jsErrors.push({
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.log(`❌ JavaScript Error: ${error.name}: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    });

    // Capturar mensagens do console
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });

      if (msg.type() === 'error') {
        console.log(`⚠️ Console Error: ${msg.text()}`);
        console.log(`Location: ${JSON.stringify(msg.location())}`);
      }
    });

    // Capturar erros de rede
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
      console.log(`🌐 Network Error: ${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('🚀 Navegando para localhost:5175...');
    await page.goto('http://localhost:5175');

    // Aguardar carregamento inicial
    console.log('⏳ Aguardando carregamento inicial...');
    await page.waitForTimeout(3000);

    // Login
    console.log('🔐 Fazendo login...');
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');

    console.log('⏳ Aguardando processamento do login...');
    await page.waitForTimeout(5000); // Mais tempo para processar

    // Verificar se há erro imediatamente após login
    const errorVisible = await page.locator('text="Erro na Aplicação"').isVisible();
    console.log(`🔍 Erro visível após login: ${errorVisible}`);

    if (errorVisible) {
      console.log('📋 Tentando expandir detalhes do erro...');

      // Tentar clicar no botão de detalhes
      const detailsButton = page.locator('text="Detalhes do Erro"');
      const hasDetailsButton = await detailsButton.count() > 0;

      if (hasDetailsButton) {
        await detailsButton.click();
        await page.waitForTimeout(2000);

        // Capturar TODO o texto da tela de erro
        const errorContainer = page.locator('[class*="error"], [class*="stack"], pre, code, .error-boundary');
        const errorTexts = await errorContainer.allTextContents();

        console.log('📄 DETALHES DO ERRO EXPANDIDO:');
        errorTexts.forEach((text, index) => {
          if (text.trim()) {
            console.log(`${index + 1}. ${text.trim()}`);
          }
        });

        // Tentar capturar elementos específicos de erro
        const stackTrace = page.locator('pre, code, [class*="stack"]');
        const stackCount = await stackTrace.count();

        for (let i = 0; i < stackCount; i++) {
          const stackText = await stackTrace.nth(i).textContent();
          if (stackText && stackText.includes('Error')) {
            console.log(`🔥 Stack Trace ${i + 1}: ${stackText}`);
          }
        }
      }

      // Screenshot do erro
      await page.screenshot({
        path: 'deep-error-capture.png',
        fullPage: true
      });
      console.log('📸 Screenshot do erro salvo: deep-error-capture.png');
    }

    // Relatório completo
    console.log('\\n📊 RELATÓRIO COMPLETO DE ERROS:');
    console.log(`JavaScript Errors: ${jsErrors.length}`);
    jsErrors.forEach((err, index) => {
      console.log(`\\nJS Error ${index + 1}:`);
      console.log(`  Nome: ${err.name}`);
      console.log(`  Mensagem: ${err.message}`);
      console.log(`  Stack: ${err.stack}`);
    });

    console.log(`\\nConsole Messages: ${consoleMessages.length}`);
    consoleMessages.forEach((msg, index) => {
      if (msg.type === 'error') {
        console.log(`\\nConsole Error ${index + 1}:`);
        console.log(`  Tipo: ${msg.type}`);
        console.log(`  Texto: ${msg.text}`);
        console.log(`  Localização: ${JSON.stringify(msg.location)}`);
      }
    });

    console.log(`\\nNetwork Errors: ${networkErrors.length}`);
    networkErrors.forEach((err, index) => {
      console.log(`\\nNetwork Error ${index + 1}:`);
      console.log(`  URL: ${err.url}`);
      console.log(`  Falha: ${err.failure}`);
    });

    // Aguardar mais um pouco para capturar erros tardios
    console.log('⏳ Aguardando possíveis erros tardios...');
    await page.waitForTimeout(3000);

    console.log('\\n🏁 Captura profunda concluída');

    // Screenshot final do estado
    await page.screenshot({
      path: 'final-error-state.png',
      fullPage: false
    });
  });
});