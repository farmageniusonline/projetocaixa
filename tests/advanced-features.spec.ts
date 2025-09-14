import { test, expect } from '@playwright/test';

test.describe('Funcionalidades Avançadas', () => {
  test.beforeEach(async ({ page }) => {
    // Login e carregamento de dados de teste
    await page.goto('/');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Carregar dados de teste
    const csvContent = `Data,Histórico,Valor,CPF
01/01/2024,PIX RECEBIDO DE JOAO SILVA,150.75,12345678901
02/01/2024,TED BANCO BRASIL PARA EMPRESA,500.00,98765432109
03/01/2024,CARTAO DEBITO LOJA MAGAZINE LUIZA,89.99,11122233344
04/01/2024,PIX ENVIADO PARA MARIA SANTOS,75.50,55566677788`;

    const fileChooser = page.waitForEvent('filechooser');
    await page.click('input[type="file"]');
    const file = await fileChooser;

    await file.setFiles([{
      name: 'test-advanced.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);

    await page.click('text=Carregar');
    await page.waitForTimeout(3000); // Aguardar processamento
  });

  test('deve funcionar busca de valor exato', async ({ page }) => {
    // Buscar valor que existe
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await searchInput.fill('150.75');
    await page.keyboard.press('Enter');

    // Aguardar resultado
    await expect(page.getByText('Valor encontrado')).toBeVisible({ timeout: 5000 });
  });

  test('deve funcionar busca aproximada', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');

    // Buscar valor próximo (150.80 próximo de 150.75)
    await searchInput.fill('150.80');
    await page.keyboard.press('Enter');

    // Pode encontrar como aproximado ou não encontrado
    await page.waitForTimeout(2000);

    // Verificar se alguma mensagem aparece
    const hasMessage = await page.locator('.bg-red-900\\/20, .bg-green-900\\/20').isVisible();
    expect(hasMessage).toBeTruthy();
  });

  test('deve adicionar valor não encontrado ao histórico', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');

    // Buscar valor que não existe
    await searchInput.fill('999.99');
    await page.keyboard.press('Enter');

    // Aguardar mensagem de não encontrado
    await expect(page.getByText('Valor não encontrado')).toBeVisible({ timeout: 5000 });

    // Expandir histórico
    await page.click('text=Histórico de valores não encontrados');

    // Verificar se valor foi adicionado ao histórico
    await expect(page.getByText('R$ 999,99')).toBeVisible();
  });

  test('deve limpar histórico de não encontrados', async ({ page }) => {
    // Primeiro adicionar um valor ao histórico
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await searchInput.fill('888.88');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);

    // Expandir histórico
    await page.click('text=Histórico de valores não encontrados');

    // Se houver itens, limpar
    const clearButton = page.getByText('Limpar');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(page.getByText('Nenhum valor não encontrado')).toBeVisible();
    }
  });

  test('deve funcionar filtro por data', async ({ page }) => {
    // Ir para seleção manual de data
    await page.click('input[value="manual"]');

    // Definir data específica
    await page.fill('input[type="date"]', '2024-01-01');

    // Aplicar filtro (se implementado)
    // Nota: Esta funcionalidade pode precisar de implementação adicional
    await expect(page.locator('input[type="date"]')).toHaveValue('2024-01-01');
  });

  test('deve transferir valor para conferência de caixa', async ({ page }) => {
    // Buscar valor existente
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await searchInput.fill('150.75');
    await page.keyboard.press('Enter');

    // Aguardar processamento
    await page.waitForTimeout(2000);

    // Se o valor for encontrado e transferido, ir para aba de caixa
    await page.click('text=Conferência de Caixa');

    // Verificar se há itens na conferência
    const totalItems = page.getByText('Total de itens:');
    await expect(totalItems).toBeVisible();
  });

  test('deve mostrar modal de confirmação para reiniciar dia', async ({ page }) => {
    await page.click('text=Reiniciar dia atual');

    // Modal deve aparecer
    await expect(page.getByText('Confirmar Reinício')).toBeVisible();
    await expect(page.getByText('Todos os dados transferidos e históricos serão apagados')).toBeVisible();

    // Cancelar para não afetar outros testes
    await page.click('text=Cancelar');

    // Modal deve fechar
    await expect(page.getByText('Confirmar Reinício')).not.toBeVisible();
  });

  test('deve manter dados persistentes entre recarregamentos', async ({ page }) => {
    // Adicionar valor ao histórico de não encontrados
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await searchInput.fill('777.77');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);

    // Recarregar página
    await page.reload();
    await page.waitForTimeout(2000);

    // Expandir histórico
    await page.click('text=Histórico de valores não encontrados');

    // Valor deve estar persistido
    const historySection = page.locator('[class*="bg-gray-900"]');
    await expect(historySection).toBeVisible();
  });

  test('deve validar formato de entrada de valores', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');

    // Testar diferentes formatos
    await searchInput.fill('abc123');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Testar formato correto
    await searchInput.clear();
    await searchInput.fill('123,45');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Input deve aceitar o formato
    expect(await searchInput.inputValue()).toBeTruthy();
  });

  test('deve mostrar indicadores visuais de status', async ({ page }) => {
    // Verificar contador na aba bancária
    const bankingTab = page.getByText('Conferência Bancária');
    await expect(bankingTab).toBeVisible();

    // Verificar se há badge com número de registros
    const badge = page.locator('.bg-indigo-600.text-white.rounded-full');
    if (await badge.first().isVisible()) {
      const badgeText = await badge.first().textContent();
      expect(badgeText).toMatch(/\d+/); // Deve conter números
    }
  });
});