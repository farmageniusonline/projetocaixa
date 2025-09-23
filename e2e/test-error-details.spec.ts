import { test, expect } from '@playwright/test';

test('Investigar detalhes específicos do erro na aplicação', async ({ page }) => {
  // Capturar logs de console
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      console.log(`🚨 Console Error: ${msg.text()}`);
    }
  });

  // Capturar erros de página
  page.on('pageerror', error => {
    console.log(`💥 Page Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  console.log('=== INVESTIGANDO ERRO ESPECÍFICO ===');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(3000);

  // Verificar se aparece tela de erro
  const errorScreen = page.locator('text="Erro na Aplicação"');

  if (await errorScreen.count() > 0) {
    console.log('❌ Tela de erro confirmada após login');

    // Tentar expandir detalhes do erro
    const errorDetailsButton = page.locator('text="Detalhes do Erro"');
    if (await errorDetailsButton.count() > 0) {
      console.log('🔍 Tentando expandir detalhes do erro...');
      await errorDetailsButton.click();
      await page.waitForTimeout(2000);

      // Capturar todo o texto da página após expandir
      const fullPageText = await page.textContent('body');
      console.log('\n📋 CONTEÚDO COMPLETO DA PÁGINA:');
      console.log(fullPageText);

      // Procurar por mensagens de erro específicas
      const errorMessages = page.locator(':has-text("Error:"), :has-text("TypeError:"), :has-text("ReferenceError:"), :has-text("failed"), :has-text("Cannot")');
      const errorCount = await errorMessages.count();

      if (errorCount > 0) {
        console.log('\n🚨 MENSAGENS DE ERRO ENCONTRADAS:');
        for (let i = 0; i < Math.min(errorCount, 5); i++) {
          const errorText = await errorMessages.nth(i).textContent();
          console.log(`  Erro ${i + 1}: ${errorText}`);
        }
      }
    }

    // Clicar em Lançamentos para ver se gera erro específico
    console.log('\n🎯 Tentando acessar aba Lançamentos...');
    const launchTab = page.locator('text=Lançamentos');

    if (await launchTab.count() > 0) {
      try {
        await launchTab.click();
        await page.waitForTimeout(3000);
        console.log('✅ Clique na aba Lançamentos executado');
      } catch (error) {
        console.log(`❌ Erro ao clicar na aba Lançamentos: ${error}`);
      }
    } else {
      console.log('⚠️ Aba Lançamentos não encontrada');
    }

  } else {
    console.log('✅ Nenhuma tela de erro detectada');
  }

  // Imprimir todos os logs coletados
  console.log('\n=== TODOS OS LOGS DO CONSOLE ===');
  consoleLogs.forEach((log, index) => {
    console.log(`${index + 1}. ${log}`);
  });

  // Screenshot final
  await page.screenshot({
    path: 'error-details-investigation.png',
    fullPage: true
  });

  console.log('\n📸 Screenshot salvo: error-details-investigation.png');
  console.log('🔍 Investigação de erro concluída');
});