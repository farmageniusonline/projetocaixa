import { test, expect } from '@playwright/test';

test('Debug - Verificar o que aparece na aba Lançamentos', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(3000);

  console.log('=== DEBUG: Verificando aba Lançamentos ===');

  // Ver se a aba Lançamentos existe
  const launchTab = page.locator('text=Lançamentos');
  if (await launchTab.count() > 0) {
    console.log('✅ Aba "Lançamentos" encontrada');

    // Clicar na aba
    await launchTab.click();
    await page.waitForTimeout(3000);

    // Capturar screenshot
    await page.screenshot({
      path: 'debug-lancamentos-page.png',
      fullPage: true
    });

    console.log('📸 Screenshot salvo: debug-lancamentos-page.png');

    // Procurar por todos os h2 na página
    const allH2 = page.locator('h2');
    const h2Count = await allH2.count();
    console.log(`📋 Encontrados ${h2Count} elementos h2:`);

    for (let i = 0; i < h2Count; i++) {
      const h2Text = await allH2.nth(i).textContent();
      console.log(`  H2 ${i + 1}: "${h2Text}"`);
    }

    // Procurar por qualquer texto que contenha "Lançament"
    const launchTexts = page.locator(':has-text("Lançament")');
    const launchCount = await launchTexts.count();
    console.log(`🎯 Encontrados ${launchCount} elementos com "Lançament":`);

    for (let i = 0; i < launchCount; i++) {
      const launchText = await launchTexts.nth(i).textContent();
      console.log(`  Lançamento ${i + 1}: "${launchText}"`);
    }

    // Procurar por botões na página
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`🔘 Encontrados ${buttonCount} botões:`);

    for (let i = 0; i < Math.min(buttonCount, 10); i++) { // Limitar a 10 primeiros
      const buttonText = await allButtons.nth(i).textContent();
      console.log(`  Botão ${i + 1}: "${buttonText}"`);
    }

    // Verificar se existe algum erro na página
    const errorTexts = page.locator(':has-text("erro"), :has-text("Erro"), :has-text("error"), :has-text("Error")');
    const errorCount = await errorTexts.count();

    if (errorCount > 0) {
      console.log(`❌ Encontrados ${errorCount} possíveis erros:`);
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorTexts.nth(i).textContent();
        console.log(`  Erro ${i + 1}: "${errorText}"`);
      }
    } else {
      console.log('✅ Nenhum erro aparente encontrado');
    }

    // Verificar console do navegador
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`🚨 Console Error: ${msg.text()}`);
      }
    });

  } else {
    console.log('❌ Aba "Lançamentos" NÃO encontrada');

    // Verificar quais abas existem
    const tabs = page.locator('[role="tab"], .tab, text*=aba, text*=Tab');
    const tabCount = await tabs.count();
    console.log(`📑 Encontradas ${tabCount} possíveis abas:`);

    for (let i = 0; i < tabCount; i++) {
      const tabText = await tabs.nth(i).textContent();
      console.log(`  Aba ${i + 1}: "${tabText}"`);
    }
  }

  console.log('🏁 Debug concluído');
});