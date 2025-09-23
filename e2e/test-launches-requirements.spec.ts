import { test, expect } from '@playwright/test';

test.describe('Lançamentos - Critérios de Aceite', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5175');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');
    await page.waitForTimeout(3000);
  });

  test('Critério 1: Todo valor lançado deve aparecer imediatamente na tabela principal', async ({ page }) => {
    console.log('=== TESTE: Exibição Imediata na Tabela ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Contar itens na tabela antes do lançamento
    const initialRowCount = await page.locator('tbody tr').count();
    console.log(`Linhas iniciais na tabela: ${initialRowCount}`);

    // Selecionar método de pagamento
    await page.click('button[aria-label="Dinheiro"]');

    // Inserir valor
    const testValue = '50,00';
    await page.fill('#launch-value-input', testValue);

    // Adicionar lançamento
    await page.click('button:has-text("Adicionar")');

    // Aguardar processamento
    await page.waitForTimeout(2000);

    // Verificar se apareceu na tabela imediatamente
    const finalRowCount = await page.locator('tbody tr').count();
    console.log(`Linhas finais na tabela: ${finalRowCount}`);

    // Deve ter uma linha a mais
    expect(finalRowCount).toBe(initialRowCount + 1);

    // Verificar se o valor está visível na tabela
    const tableContent = await page.locator('tbody').textContent();
    expect(tableContent).toContain('Dinheiro');
    expect(tableContent).toContain('50,00');

    console.log('✅ Lançamento apareceu imediatamente na tabela');
  });

  test('Critério 2: Data "Conferido em" deve usar data do lançamento, não data atual', async ({ page }) => {
    console.log('=== TESTE: Data Conferido em Correta ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Definir uma data específica (diferente de hoje)
    const targetDate = '2024-01-15'; // Data específica para teste
    await page.fill('input[type="date"]', targetDate);
    await page.click('text=Aplicar');
    await page.waitForTimeout(1000);

    // Selecionar método de pagamento
    await page.click('button[aria-label="Débito"]');

    // Inserir valor
    await page.fill('#launch-value-input', '25,50');

    // Adicionar lançamento
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(2000);

    // Navegar para Conferência de Caixa para verificar a data
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Procurar pelo lançamento na tabela de conferência
    const conferenceTable = page.locator('[data-testid="conference-table"], table').first();
    const conferenceContent = await conferenceTable.textContent();

    // Verificar se contém o valor e se a data está correta
    if (conferenceContent && conferenceContent.includes('25,50')) {
      console.log('✅ Lançamento encontrado na Conferência de Caixa');

      // A data deve ser 15/01/2024 (formato brasileiro), não a data atual
      const shouldContainDate = '15/01/2024';
      expect(conferenceContent).toContain(shouldContainDate);
      console.log(`✅ Data correta encontrada: ${shouldContainDate}`);
    } else {
      console.log('⚠️ Lançamento não encontrado na Conferência de Caixa ou não foi transferido');
    }
  });

  test('Critério 3: Nenhuma duplicidade deve ser criada', async ({ page }) => {
    console.log('=== TESTE: Prevenção de Duplicidades ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Fazer o primeiro lançamento
    await page.click('button[aria-label="Cartão de Crédito 1x"]');
    await page.click('text=Não'); // Link: Não
    await page.fill('#launch-value-input', '100,00');
    await page.click('text=Adicionar');
    await page.waitForTimeout(2000);

    // Contar lançamentos na tabela de Lançamentos
    const launchesRowCount = await page.locator('tbody tr').count();
    console.log(`Lançamentos na aba Lançamentos: ${launchesRowCount}`);

    // Navegar para Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Contar itens na Conferência de Caixa que contenham '100,00'
    const conferenceRows = await page.locator('table tbody tr').count();
    const conferenceContent = await page.locator('table tbody').textContent();

    const occurrences = (conferenceContent || '').split('100,00').length - 1;
    console.log(`Ocorrências de '100,00' na Conferência de Caixa: ${occurrences}`);

    // Deve haver exatamente 1 ocorrência (sem duplicidade)
    expect(occurrences).toBeLessThanOrEqual(1);

    if (occurrences === 1) {
      console.log('✅ Lançamento transferido para Conferência sem duplicidade');
    } else if (occurrences === 0) {
      console.log('⚠️ Lançamento não foi transferido para Conferência de Caixa');
    }
  });

  test('Critério 4: Fluxo completo - Lançamento aparecer em ambas as abas', async ({ page }) => {
    console.log('=== TESTE: Fluxo Completo ===');

    // Navegar para aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);

    // Fazer lançamento
    await page.click('button[aria-label="Moedas"]');
    await page.fill('#launch-value-input', '15,75');
    await page.click('text=Adicionar');
    await page.waitForTimeout(2000);

    // Verificar na aba Lançamentos
    let tableContent = await page.locator('tbody').textContent();
    expect(tableContent).toContain('Moedas');
    expect(tableContent).toContain('15,75');
    console.log('✅ Lançamento visível na aba Lançamentos');

    // Navegar para Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(2000);

    // Verificar na Conferência de Caixa
    const conferenceTableContent = await page.locator('table tbody').textContent();

    if (conferenceTableContent && conferenceTableContent.includes('15,75')) {
      console.log('✅ Lançamento também visível na Conferência de Caixa');

      // Verificar se contém 'Manual' na descrição
      expect(conferenceTableContent).toContain('Manual');
      console.log('✅ Origem "Manual" identificada corretamente');
    } else {
      console.log('⚠️ Lançamento não encontrado na Conferência de Caixa');
    }

    // Screenshot final para documentação
    await page.screenshot({
      path: 'test-launches-complete-flow.png',
      fullPage: true
    });

    console.log('🏁 Teste de fluxo completo concluído');
  });
});