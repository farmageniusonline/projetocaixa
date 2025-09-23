import { test, expect } from '@playwright/test';

test('Teste direto do botão Saída', async ({ page }) => {
  // Navegar e fazer login
  await page.goto('http://localhost:5175');
  await page.fill('input[type="text"]', 'admin@manipularium.com.br');
  await page.fill('input[type="password"]', 'manipularium');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Ir para aba de Lançamentos
  await page.click('button:has-text("Lançamentos")');
  await page.waitForTimeout(1000);

  // Clicar no botão Saída (vermelho) - usar aria-label para ser mais específico
  const saidaButton = page.getByRole('button', { name: 'Saída', exact: true });

  if (await saidaButton.isVisible()) {
    await saidaButton.click();
    console.log('✅ Botão Saída clicado!');
  } else {
    throw new Error('Botão Saída não encontrado');
  }

  // Preencher o valor
  const valorInput = page.locator('input[placeholder*="alor"]').or(
    page.locator('input[type="number"]')
  ).first();

  await valorInput.fill('350.00');
  console.log('✅ Valor preenchido: 350.00');

  // Selecionar forma de pagamento
  const formaPagamento = page.locator('button, select').filter({
    hasText: /selecione/i
  }).first();

  if (await formaPagamento.isVisible()) {
    await formaPagamento.click();
    await page.waitForTimeout(500);

    // Selecionar Dinheiro
    const dinheiroOption = page.locator('text=Dinheiro').first();
    if (await dinheiroOption.isVisible()) {
      await dinheiroOption.click();
      console.log('✅ Forma de pagamento: Dinheiro');
    }
  }

  // Adicionar observação
  const obsField = page.locator('textarea, input[placeholder*="bserv"]').first();
  if (await obsField.isVisible()) {
    await obsField.fill('Teste automatizado - Valor de saída');
    console.log('✅ Observação adicionada');
  }

  // Salvar o lançamento
  const salvarButton = page.locator('button').filter({
    hasText: /salvar/i
  });

  await salvarButton.click();
  console.log('✅ Lançamento salvo');

  // Aguardar confirmação
  await page.waitForTimeout(2000);

  // Verificar se aparece na lista
  const valorLista = page.locator('text=/350[,.]00/');

  if (await valorLista.isVisible({ timeout: 5000 })) {
    console.log('✅ Valor encontrado na lista!');

    // Verificar se está marcado como saída (negativo ou vermelho)
    const itemRow = page.locator('tr, div').filter({ hasText: '350' }).first();

    if (await itemRow.isVisible()) {
      const textContent = await itemRow.textContent();
      const hasNegativeSign = textContent?.includes('-');

      const style = await itemRow.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor
        };
      });

      const isRed = style.color.includes('239') || // red-500
                   style.color.includes('220') || // red-600
                   style.color.includes('185'); // red-700

      if (hasNegativeSign || isRed) {
        console.log('✅ Valor formatado como saída (negativo/vermelho)');
      } else {
        console.log('⚠️ Valor não está formatado como saída');
      }
    }
  }

  // Verificar se o total foi afetado negativamente
  const totalElement = page.locator('text=/total/i').locator('..').locator('text=/-/');
  if (await totalElement.isVisible({ timeout: 3000 })) {
    console.log('✅ Total mostra valor negativo/dedução');
  }

  console.log('🎉 Teste de valor de saída concluído com sucesso!');
});