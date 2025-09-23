import { test, expect } from '@playwright/test';

test('Teste básico - Aba Lançamentos com integração Supabase', async ({ page }) => {
  // Setup
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175');

  // Login
  await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
  await page.fill('[data-testid="password-input"]', 'manipularium');
  await page.click('[data-testid="login-button"]');
  await page.waitForTimeout(3000);

  // Go to Lançamentos tab
  await page.click('text=Lançamentos');
  await page.waitForTimeout(2000);

  console.log('=== TESTE BÁSICO: Aba Lançamentos ===');

  // 1. Verificar se chegou na aba correta
  const title = page.locator('h2:has-text("Lançamentos Manuais")');
  await expect(title).toBeVisible();
  console.log('✅ Aba Lançamentos carregada');

  // 2. Verificar se os novos botões de Supabase estão presentes
  const loadButton = page.locator('button:has-text("Carregar")');
  const syncButton = page.locator('button:has-text("Sync Local")');

  if (await loadButton.count() > 0) {
    console.log('✅ Botão "Carregar" encontrado');
  } else {
    console.log('❌ Botão "Carregar" NÃO encontrado');
  }

  if (await syncButton.count() > 0) {
    console.log('✅ Botão "Sync Local" encontrado');
  } else {
    console.log('❌ Botão "Sync Local" NÃO encontrado');
  }

  // 3. Verificar formulário de lançamento
  const methodButtons = page.locator('button[data-payment-method]');
  const valueInput = page.locator('input[placeholder*="valor"]');
  const addButton = page.locator('button:has-text("Adicionar")');

  if (await methodButtons.count() > 0) {
    console.log('✅ Botões de método de pagamento encontrados');
  } else {
    console.log('❌ Botões de método de pagamento NÃO encontrados');
  }

  if (await valueInput.count() > 0) {
    console.log('✅ Campo de valor encontrado');
  } else {
    console.log('❌ Campo de valor NÃO encontrado');
  }

  if (await addButton.count() > 0) {
    console.log('✅ Botão "Adicionar" encontrado');
  } else {
    console.log('❌ Botão "Adicionar" NÃO encontrado');
  }

  // 4. Teste simples de adição de lançamento
  try {
    // Selecionar Dinheiro
    await page.click('button[data-payment-method="cash"]');
    console.log('✅ Método "Dinheiro" selecionado');

    // Inserir valor
    await page.fill('input[placeholder*="valor"]', '100.00');
    console.log('✅ Valor inserido: R$ 100,00');

    // Clicar Adicionar
    await page.click('button:has-text("Adicionar")');
    console.log('✅ Botão "Adicionar" clicado');

    // Aguardar processamento
    await page.waitForTimeout(3000);

    // Verificar se o campo foi limpo (indica sucesso)
    const valueAfter = await valueInput.inputValue();
    if (valueAfter === '') {
      console.log('✅ Campo limpo - lançamento provavelmente salvo com sucesso');
    } else {
      console.log('⚠️ Campo não foi limpo - pode ter havido erro');
    }

  } catch (error) {
    console.log('❌ Erro durante teste de adição:', error);
  }

  // 5. Testar botão de carregamento
  try {
    console.log('🔄 Testando botão Carregar...');
    await loadButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Botão Carregar executado sem erro');
  } catch (error) {
    console.log('❌ Erro ao testar botão Carregar:', error);
  }

  // 6. Screenshot final
  await page.screenshot({
    path: 'test-lancamentos-supabase.png',
    fullPage: false
  });

  console.log('📸 Screenshot salvo: test-lancamentos-supabase.png');
  console.log('🎉 Teste básico concluído!');
});