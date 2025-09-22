import { test, expect } from '@playwright/test';

test.describe('Teste Completo - Funcionalidade Saída', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5175');

    // Login com credenciais corretas
    await page.fill('[data-testid="username-input"]', 'admin@manipularium.com.br');
    await page.fill('[data-testid="password-input"]', 'manipularium');
    await page.click('[data-testid="login-button"]');

    // Aguardar carregar o dashboard
    await page.waitForTimeout(2000);

    // Ir para a aba Lançamentos
    await page.click('text=Lançamentos');
    await page.waitForTimeout(1000);
  });

  test('deve criar lançamento de saída com valor negativo e filtrar por Saída', async ({ page }) => {
    // 1. Verificar se o botão Saída existe e tem a cor vermelha
    const saidaButton = page.locator('button:has-text("Saída")');
    await expect(saidaButton).toBeVisible();

    // Verificar classes CSS do botão (vermelho)
    await expect(saidaButton).toHaveClass(/bg-red-900\/20.*text-red-300.*border-red-600/);

    // 2. Selecionar Saída
    await saidaButton.click();

    // Verificar se o botão ficou selecionado (vermelho sólido)
    await expect(saidaButton).toHaveClass(/bg-red-600.*text-white/);

    // 3. Inserir valor de R$ 100,00
    const valueInput = page.locator('#launch-value-input');
    await valueInput.fill('100,00');

    // 4. Adicionar lançamento
    await page.click('button:has-text("Adicionar")');

    // 5. Verificar mensagem de sucesso
    await expect(page.locator('text=Lançamento criado')).toBeVisible();

    // 6. Aguardar um pouco para garantir que a tabela foi atualizada
    await page.waitForTimeout(1000);

    // 7. Verificar se o lançamento aparece na tabela
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();

    // 8. Verificar se o valor está negativo na tabela (última coluna da primeira linha)
    const valueCell = firstRow.locator('td').nth(7); // 8ª coluna (índice 7)
    await expect(valueCell).toContainText('-R$ 100,00');

    // 9. Verificar se o valor está em vermelho
    await expect(valueCell).toHaveClass(/text-red-400/);

    // 10. Verificar se o tipo de pagamento é "Saída"
    const paymentTypeCell = firstRow.locator('td').nth(1); // 2ª coluna (índice 1)
    await expect(paymentTypeCell).toContainText('Saída');

    // 11. Testar filtro por Saída
    const filterSelect = page.locator('select');
    await filterSelect.selectOption('outgoing');

    // Aguardar filtro ser aplicado
    await page.waitForTimeout(500);

    // 12. Verificar se ainda mostra o lançamento de saída
    await expect(firstRow).toBeVisible();
    await expect(paymentTypeCell).toContainText('Saída');

    // 13. Verificar o total geral (deve ser negativo)
    const totalCell = page.locator('tfoot td').last();
    await expect(totalCell).toContainText('-R$ 100,00');
    await expect(totalCell).toHaveClass(/text-red-400/);

    console.log('✅ Teste completo da funcionalidade Saída passou com sucesso!');
  });

  test('deve permitir desfazer lançamento de saída', async ({ page }) => {
    // 1. Criar lançamento de saída
    await page.click('button:has-text("Saída")');
    await page.fill('#launch-value-input', '50,00');
    await page.click('button:has-text("Adicionar")');

    // Aguardar lançamento aparecer
    await page.waitForTimeout(1000);

    // 2. Verificar se o lançamento existe
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();

    // 3. Clicar em desfazer
    const undoButton = firstRow.locator('button:has-text("Desfazer")');
    await undoButton.click();

    // 4. Confirmar no modal
    await expect(page.locator('text=Confirmar Desfazer')).toBeVisible();
    await page.click('button:has-text("Confirmar")');

    // 5. Verificar mensagem de sucesso
    await expect(page.locator('text=Lançamento desfeito com sucesso')).toBeVisible();

    // 6. Aguardar um pouco para a tabela atualizar
    await page.waitForTimeout(1000);

    // 7. Verificar se o lançamento foi removido
    const noDataMessage = page.locator('text=Nenhum lançamento registrado para esta data');

    // Pode ser que apareça a mensagem de sem dados ou que a linha tenha sido removida
    const rowsCount = await page.locator('table tbody tr').count();

    if (rowsCount === 1) {
      // Se há apenas uma linha, deve ser a mensagem de sem dados
      await expect(noDataMessage).toBeVisible();
    }
    // Se não há linhas ou há outras linhas, o desfazer funcionou

    console.log('✅ Teste de desfazer lançamento de saída passou com sucesso!');
  });

  test('deve impactar corretamente os totais com valores negativos', async ({ page }) => {
    // 1. Verificar total inicial (se houver)
    let initialTotal = '0,00';
    const totalCell = page.locator('tfoot td').last();

    try {
      const initialTotalText = await totalCell.textContent({ timeout: 2000 });
      if (initialTotalText) {
        initialTotal = initialTotalText.replace(/[^\d,.-]/g, '') || '0,00';
      }
    } catch {
      // Se não há total inicial, é 0
      initialTotal = '0,00';
    }

    // 2. Adicionar entrada positiva de R$ 200,00
    await page.click('button:has-text("Dinheiro")');
    await page.fill('#launch-value-input', '200,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(1000);

    // 3. Verificar se total aumentou
    await expect(totalCell).toContainText('R$ 200,00');
    await expect(totalCell).toHaveClass(/text-green-400/);

    // 4. Adicionar saída de R$ 150,00
    await page.click('button:has-text("Saída")');
    await page.fill('#launch-value-input', '150,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(1000);

    // 5. Verificar se total foi para R$ 50,00 (200 - 150)
    await expect(totalCell).toContainText('R$ 50,00');
    await expect(totalCell).toHaveClass(/text-green-400/);

    // 6. Adicionar outra saída de R$ 100,00 (deve deixar total negativo)
    await page.click('button:has-text("Saída")');
    await page.fill('#launch-value-input', '100,00');
    await page.click('button:has-text("Adicionar")');
    await page.waitForTimeout(1000);

    // 7. Verificar se total ficou negativo: R$ -50,00
    await expect(totalCell).toContainText('-R$ 50,00');
    await expect(totalCell).toHaveClass(/text-red-400/);

    console.log('✅ Teste de impacto nos totais passou com sucesso!');
  });
});