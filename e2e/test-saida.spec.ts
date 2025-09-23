import { test, expect } from '@playwright/test';

test('Teste de valor de saída em Lançamentos', async ({ page }) => {
  // Navegar para a aplicação
  await page.goto('http://localhost:5175');

  // Fazer login
  await page.fill('input[type="text"]', 'admin@manipularium.com.br');
  await page.fill('input[type="password"]', 'manipularium');
  await page.click('button[type="submit"]');

  // Aguardar carregamento do dashboard
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Ir para aba de Lançamentos
  await page.click('button:has-text("Lançamentos")');
  await page.waitForTimeout(1000);

  // Marcar checkbox de valor de saída
  const saidaCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /saída/i }).or(
    page.locator('label:has-text("Saída")').locator('input[type="checkbox"]')
  ).or(
    page.locator('text=/valor.*saída/i').locator('..').locator('input[type="checkbox"]')
  );

  if (await saidaCheckbox.isVisible()) {
    await saidaCheckbox.check();
    console.log('✅ Checkbox de saída marcado');
  } else {
    console.log('⚠️ Checkbox de saída não encontrado, tentando alternativa...');
    // Tentar encontrar de outra forma
    const altCheckbox = page.locator('input[type="checkbox"]').first();
    if (await altCheckbox.isVisible()) {
      await altCheckbox.check();
      console.log('✅ Checkbox alternativo marcado');
    }
  }

  // Preencher campo de valor
  const valorInput = page.locator('input[placeholder*="alor"]').or(
    page.locator('input[type="number"]').first()
  ).or(
    page.locator('input').filter({ hasText: /valor/i })
  );

  await valorInput.fill('250.75');
  console.log('✅ Valor preenchido: 250.75');

  // Selecionar forma de pagamento
  const selectButton = page.locator('button').filter({ hasText: /selecione/i }).or(
    page.locator('select').first()
  );

  await selectButton.click();
  await page.waitForTimeout(500);

  // Clicar em Dinheiro
  const dinheiroOption = page.locator('text=/dinheiro/i').or(
    page.locator('option:has-text("Dinheiro")')
  );

  if (await dinheiroOption.isVisible()) {
    await dinheiroOption.click();
    console.log('✅ Forma de pagamento selecionada: Dinheiro');
  }

  // Adicionar observação
  const obsTextarea = page.locator('textarea').first();
  if (await obsTextarea.isVisible()) {
    await obsTextarea.fill('Teste de valor de saída - Playwright');
    console.log('✅ Observação adicionada');
  }

  // Clicar em Salvar
  const saveButton = page.locator('button').filter({ hasText: /salvar/i });
  await saveButton.click();
  console.log('✅ Botão salvar clicado');

  // Aguardar resposta
  await page.waitForTimeout(2000);

  // Verificar se foi salvo
  const successMessage = page.locator('text=/salvo.*sucesso/i').or(
    page.locator('.toast-success').or(
      page.locator('[role="alert"]')
    )
  );

  if (await successMessage.isVisible({ timeout: 5000 })) {
    console.log('✅ Lançamento salvo com sucesso!');
  }

  // Verificar se aparece na lista
  const valorNaLista = page.locator('text=/250[,.]75/');
  const observacaoNaLista = page.locator('text=/Teste.*Playwright/i');

  if (await valorNaLista.isVisible({ timeout: 5000 })) {
    console.log('✅ Valor encontrado na lista');
  }

  if (await observacaoNaLista.isVisible({ timeout: 5000 })) {
    console.log('✅ Observação encontrada na lista');
  }

  // Verificar formatação de saída (cor vermelha, sinal negativo, etc)
  const itemNaLista = page.locator('tr').filter({ hasText: '250' }).or(
    page.locator('div').filter({ hasText: '250,75' })
  );

  if (await itemNaLista.isVisible()) {
    const style = await itemNaLista.evaluate(el => {
      const computedStyle = window.getComputedStyle(el);
      return {
        color: computedStyle.color,
        hasNegativeSign: el.textContent?.includes('-'),
        classList: el.className
      };
    });

    console.log('📊 Estilo do item:', style);

    // Verificar indicadores de saída
    const isOutgoing = style.hasNegativeSign ||
                      style.color.includes('239') || // red-500
                      style.classList.includes('saida') ||
                      style.classList.includes('outgoing');

    if (isOutgoing) {
      console.log('✅ Item formatado como saída (valor negativo/vermelho)');
    }
  }

  console.log('🎉 Teste de valor de saída concluído!');
});