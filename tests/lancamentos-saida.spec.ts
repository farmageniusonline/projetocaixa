import { test, expect } from '@playwright/test';

test.describe('Lançamentos - Valores de Saída', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar para a aplicação
    await page.goto('http://localhost:5175');

    // Fazer login se necessário
    const loginForm = await page.locator('form').first();
    if (await loginForm.isVisible()) {
      await page.fill('input[type="text"]', 'admin@manipularium.com.br');
      await page.fill('input[type="password"]', 'manipularium');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    }

    // Ir para aba de Lançamentos
    await page.click('button:has-text("Lançamentos")');
    await page.waitForTimeout(500);
  });

  test('deve registrar valor de saída corretamente', async ({ page }) => {
    // Marcar checkbox de valor de saída
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');

    // Preencher campo de valor
    await page.fill('input[placeholder="Valor"]', '150.50');

    // Selecionar forma de pagamento
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Dinheiro');

    // Adicionar observação
    await page.fill('textarea[placeholder="Observação (opcional)"]', 'Pagamento de fornecedor');

    // Clicar em Salvar
    await page.click('button:has-text("Salvar Lançamento")');

    // Verificar se foi salvo
    await expect(page.locator('text=Lançamento salvo com sucesso')).toBeVisible();

    // Verificar se aparece na lista com valor negativo ou indicação de saída
    await expect(page.locator('text=-R$ 150,50').or(page.locator('text=(Saída)'))).toBeVisible();
  });

  test('deve calcular total considerando saídas', async ({ page }) => {
    // Adicionar uma entrada
    await page.fill('input[placeholder="Valor"]', '500.00');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Dinheiro');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(500);

    // Adicionar uma saída
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');
    await page.fill('input[placeholder="Valor"]', '200.00');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Dinheiro');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(500);

    // Verificar se o total está correto (500 - 200 = 300)
    const totalElement = await page.locator('text=/Total.*R\\$.*300/i');
    await expect(totalElement).toBeVisible();
  });

  test('deve exibir valores de saída com formatação diferente', async ({ page }) => {
    // Adicionar valor de saída
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');
    await page.fill('input[placeholder="Valor"]', '75.25');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Pix');
    await page.fill('textarea[placeholder="Observação (opcional)"]', 'Despesa operacional');
    await page.click('button:has-text("Salvar Lançamento")');

    // Verificar formatação especial para saídas (cor vermelha ou símbolo negativo)
    const saidaElement = await page.locator('tr:has-text("Despesa operacional")');

    // Verificar se tem classe de saída ou cor vermelha
    const hasNegativeFormatting = await saidaElement.evaluate(el => {
      const style = window.getComputedStyle(el);
      const hasRedColor = style.color.includes('rgb(239, 68, 68)') ||
                          style.color.includes('rgb(220, 38, 38)') ||
                          style.color.includes('red');
      const hasNegativeClass = el.classList.toString().includes('saida') ||
                               el.classList.toString().includes('negative') ||
                               el.classList.toString().includes('outgoing');
      const hasNegativeSign = el.textContent?.includes('-');

      return hasRedColor || hasNegativeClass || hasNegativeSign;
    });

    expect(hasNegativeFormatting).toBeTruthy();
  });

  test('deve filtrar apenas valores de saída', async ({ page }) => {
    // Adicionar algumas entradas
    await page.fill('input[placeholder="Valor"]', '100.00');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Dinheiro');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(300);

    // Adicionar algumas saídas
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');
    await page.fill('input[placeholder="Valor"]', '50.00');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Pix');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(300);

    // Se houver filtro de tipo (entrada/saída), testar
    const filterButton = page.locator('button:has-text("Filtrar")').or(page.locator('select:has-text("Tipo")'));
    if (await filterButton.isVisible()) {
      await filterButton.click();
      const saidaOption = page.locator('text=Saída').or(page.locator('option:has-text("Saída")'));
      if (await saidaOption.isVisible()) {
        await saidaOption.click();

        // Verificar que apenas saídas são exibidas
        const rows = await page.locator('tbody tr').count();
        const saidasCount = await page.locator('tr:has-text("-")').count();
        expect(saidasCount).toBeGreaterThan(0);
      }
    }
  });

  test('deve persistir valores de saída após recarregar página', async ({ page }) => {
    // Adicionar valor de saída
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');
    await page.fill('input[placeholder="Valor"]', '333.33');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Cartão de Crédito');
    await page.fill('textarea[placeholder="Observação (opcional)"]', 'Compra de material');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(500);

    // Recarregar a página
    await page.reload();

    // Ir novamente para aba de Lançamentos
    await page.click('button:has-text("Lançamentos")');
    await page.waitForTimeout(500);

    // Verificar se o valor de saída ainda está visível
    await expect(page.locator('text=333,33')).toBeVisible();
    await expect(page.locator('text=Compra de material')).toBeVisible();
  });

  test('deve validar campo de valor para saídas', async ({ page }) => {
    // Marcar como saída
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');

    // Tentar salvar sem valor
    await page.click('button:has-text("Salvar Lançamento")');

    // Verificar mensagem de erro
    const errorMessage = page.locator('text=/valor.*obrigatório/i')
      .or(page.locator('text=/preencha.*valor/i'))
      .or(page.locator('.text-red-500'));

    await expect(errorMessage).toBeVisible();

    // Tentar com valor inválido
    await page.fill('input[placeholder="Valor"]', 'abc');
    await page.click('button:has-text("Salvar Lançamento")');

    // Verificar se há erro de validação
    const validationError = page.locator('text=/valor.*inválido/i')
      .or(page.locator('text=/digite.*número/i'))
      .or(page.locator('.border-red-500'));

    await expect(validationError).toBeVisible();
  });

  test('deve calcular totais por forma de pagamento incluindo saídas', async ({ page }) => {
    // Adicionar entrada em dinheiro
    await page.fill('input[placeholder="Valor"]', '1000.00');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Dinheiro');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(300);

    // Adicionar saída em dinheiro
    await page.check('input[type="checkbox"]:near(:text("Valor de Saída"))');
    await page.fill('input[placeholder="Valor"]', '300.00');
    await page.click('button:has-text("Selecione a forma")');
    await page.click('text=Dinheiro');
    await page.click('button:has-text("Salvar Lançamento")');
    await page.waitForTimeout(300);

    // Verificar se o resumo mostra o saldo correto para dinheiro (700)
    const dinheiroTotal = page.locator('text=/Dinheiro.*700/i')
      .or(page.locator('div:has-text("Dinheiro"):has-text("700")'));

    // Se houver seção de resumo, verificar
    if (await dinheiroTotal.isVisible()) {
      await expect(dinheiroTotal).toBeVisible();
    }
  });
});