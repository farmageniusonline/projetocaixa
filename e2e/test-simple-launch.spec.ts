import { test, expect } from '@playwright/test';

test('Debug: Teste simples de lançamento', async ({ page }) => {
  console.log('=== DEBUG: Teste Simples de Lançamento ===');

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
    console.log('❌ Erro detectado após login');
    await page.screenshot({ path: 'debug-error-after-login.png' });
    return;
  }

  // Navegar para aba Lançamentos
  console.log('📋 Navegando para aba Lançamentos...');
  const launchTab = page.locator('text=Lançamentos');
  const hasLaunchTab = await launchTab.count() > 0;

  if (!hasLaunchTab) {
    console.log('❌ Aba Lançamentos não encontrada');
    await page.screenshot({ path: 'debug-no-launch-tab.png' });
    return;
  }

  await launchTab.click();
  await page.waitForTimeout(2000);

  // Verificar se há erro após navegar
  const hasErrorAfterNav = await page.locator('text="Erro na Aplicação"').isVisible();
  if (hasErrorAfterNav) {
    console.log('❌ Erro detectado após navegar para Lançamentos');
    await page.screenshot({ path: 'debug-error-after-nav.png' });
    return;
  }

  console.log('✅ Navegação para Lançamentos bem-sucedida');

  // Verificar elementos da interface usando seletores mais específicos
  const hasPaymentButtons = await page.locator('button[aria-label="Dinheiro"]').isVisible();
  const hasValueInput = await page.locator('#launch-value-input').isVisible();
  const hasAddButton = await page.locator('button:has-text("Adicionar")').isVisible();

  console.log(`Botões de pagamento visíveis: ${hasPaymentButtons}`);
  console.log(`Campo de valor visível: ${hasValueInput}`);
  console.log(`Botão Adicionar visível: ${hasAddButton}`);

  if (hasPaymentButtons && hasValueInput && hasAddButton) {
    console.log('✅ Interface de lançamentos carregada corretamente');

    // Tentar fazer um lançamento simples
    await page.click('button[aria-label="Dinheiro"]');
    await page.waitForTimeout(500);

    await page.fill('#launch-value-input', '10,00');
    await page.waitForTimeout(500);

    console.log('🚀 Tentando adicionar lançamento...');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(3000);

    // Verificar se houve erro após adicionar
    const hasErrorAfterAdd = await page.locator('text="Erro na Aplicação"').isVisible();
    if (hasErrorAfterAdd) {
      console.log('❌ Erro detectado após adicionar lançamento');
      await page.screenshot({ path: 'debug-error-after-add.png' });
    } else {
      console.log('✅ Lançamento adicionado sem erro JavaScript');

      // Verificar se apareceu na tabela
      const tableContent = await page.locator('tbody').textContent();
      console.log('Conteúdo da tabela:', tableContent?.substring(0, 200));

      if (tableContent && tableContent.includes('10,00')) {
        console.log('✅ Valor encontrado na tabela');
      } else {
        console.log('⚠️ Valor não encontrado na tabela');
      }
    }
  } else {
    console.log('❌ Interface de lançamentos não carregou corretamente');
  }

  await page.screenshot({ path: 'debug-final-state.png' });
  console.log('🏁 Debug concluído');
});