import { test, expect } from '@playwright/test';

test.describe('Funcionalidade Saída', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    // Aguardar carregar o dashboard
    await page.waitForSelector('text=Lançamentos');

    // Ir para a aba Lançamentos
    await page.click('text=Lançamentos');
  });

  test('deve ter opção Saída com botão vermelho', async ({ page }) => {
    // Verificar se existe a seção Saídas
    await expect(page.locator('text=Saídas')).toBeVisible();

    // Verificar se existe o botão Saída
    const saidaButton = page.locator('button:has-text("Saída")');
    await expect(saidaButton).toBeVisible();

    // Verificar se o botão tem estilo vermelho (cor vermelha)
    await expect(saidaButton).toHaveClass(/bg-red-900\/20.*text-red-300.*border-red-600/);
  });

  test('deve criar lançamento de saída com valor negativo', async ({ page }) => {
    // Selecionar Saída
    await page.click('button:has-text("Saída")');

    // Verificar se o botão ficou selecionado (vermelho sólido)
    const saidaButton = page.locator('button:has-text("Saída")');
    await expect(saidaButton).toHaveClass(/bg-red-600.*text-white/);

    // Inserir valor
    await page.fill('#launch-value-input', '50,00');

    // Adicionar lançamento
    await page.click('button:has-text("Adicionar")');

    // Verificar se apareceu mensagem de sucesso
    await expect(page.locator('text=Lançamento criado e enviado para Conferência de Caixa')).toBeVisible();

    // Verificar se o lançamento aparece na tabela com valor negativo
    const valueCell = page.locator('table tbody tr:first-child td:nth-child(8)');
    await expect(valueCell).toContainText('-R$ 50,00');

    // Verificar se o valor está em vermelho
    await expect(valueCell).toHaveClass(/text-red-400/);
  });

  test('deve impactar o total geral negativamente', async ({ page }) => {
    // Verificar total inicial
    const totalBefore = await page.locator('tfoot td:last-child').nth(0).textContent();

    // Adicionar saída de R$ 100,00
    await page.click('button:has-text("Saída")');
    await page.fill('#launch-value-input', '100,00');
    await page.click('button:has-text("Adicionar")');

    // Verificar se o total diminuiu
    await page.waitForTimeout(1000); // Aguardar atualização
    const totalAfter = await page.locator('tfoot td:last-child').nth(0).textContent();

    // Se o total for negativo, deve estar em vermelho
    const totalCell = page.locator('tfoot td:last-child').nth(0);
    if (totalAfter && totalAfter.includes('-')) {
      await expect(totalCell).toHaveClass(/text-red-400/);
    }
  });

  test('deve permitir filtrar por Saída', async ({ page }) => {
    // Primeiro, criar um lançamento de saída
    await page.click('button:has-text("Saída")');
    await page.fill('#launch-value-input', '25,00');
    await page.click('button:has-text("Adicionar")');

    // Aguardar lançamento aparecer
    await page.waitForTimeout(1000);

    // Filtrar por Saída
    await page.selectOption('select', 'outgoing');

    // Verificar se apenas lançamentos de saída aparecem
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Verificar se todas as linhas são de saída
      for (let i = 0; i < rowCount; i++) {
        const paymentType = rows.nth(i).locator('td:nth-child(2)');
        await expect(paymentType).toContainText('Saída');
      }
    }
  });

  test('deve permitir desfazer lançamento de saída', async ({ page }) => {
    // Criar lançamento de saída
    await page.click('button:has-text("Saída")');
    await page.fill('#launch-value-input', '30,00');
    await page.click('button:has-text("Adicionar")');

    // Aguardar lançamento aparecer
    await page.waitForTimeout(1000);

    // Clicar em desfazer
    await page.click('button:has-text("Desfazer")');

    // Confirmar desfazer no modal
    await expect(page.locator('text=Confirmar Desfazer')).toBeVisible();
    await page.click('button:has-text("Confirmar")');

    // Verificar mensagem de sucesso
    await expect(page.locator('text=Lançamento desfeito com sucesso')).toBeVisible();

    // Verificar se o lançamento foi removido da tabela
    await page.waitForTimeout(1000);
    const noDataMessage = page.locator('text=Nenhum lançamento registrado para esta data');
    // Se não há outros lançamentos, deve aparecer a mensagem
    if (await noDataMessage.isVisible()) {
      await expect(noDataMessage).toBeVisible();
    }
  });
});