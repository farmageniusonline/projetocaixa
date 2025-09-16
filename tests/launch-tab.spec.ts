import { test, expect } from '@playwright/test';

test.describe('Launch Tab E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Login (assuming there's a login form)
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForSelector('text=Lançamentos');

    // Click on Launch tab
    await page.click('text=Lançamentos');
  });

  test('should display launch tab correctly', async ({ page }) => {
    // Check main sections are visible
    await expect(page.locator('text=Selecionar Pagamento')).toBeVisible();
    await expect(page.locator('text=Preencher Valor')).toBeVisible();
    await expect(page.locator('text=Filtrar por Data')).toBeVisible();
    await expect(page.locator('text=Lançamentos Manuais')).toBeVisible();
  });

  test('should show payment method options', async ({ page }) => {
    // Check credit card options
    await expect(page.locator('text=Cartão de Crédito 1x')).toBeVisible();
    await expect(page.locator('text=Cartão de Crédito 2x')).toBeVisible();
    await expect(page.locator('text=Cartão de Crédito 3x')).toBeVisible();
    await expect(page.locator('text=Cartão de Crédito 4x')).toBeVisible();
    await expect(page.locator('text=Cartão de Crédito 5x')).toBeVisible();

    // Check other payment methods
    await expect(page.locator('text=Débito')).toBeVisible();
    await expect(page.locator('text=Dinheiro')).toBeVisible();
    await expect(page.locator('text=Moedas')).toBeVisible();
    await expect(page.locator('text=Depósito')).toBeVisible();
  });

  test('should show link option when credit card is selected', async ({ page }) => {
    // Click on credit card option
    await page.click('text=Cartão de Crédito 1x');

    // Check link options appear
    await expect(page.locator('text=É link?')).toBeVisible();
    await expect(page.locator('button:has-text("Sim")')).toBeVisible();
    await expect(page.locator('button:has-text("Não")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to add without selecting payment method
    await page.click('button:has-text("Adicionar")');

    // Check error message
    await expect(page.locator('text=Selecione um método de pagamento')).toBeVisible();
  });

  test('should validate credit card link requirement', async ({ page }) => {
    // Select credit card
    await page.click('text=Cartão de Crédito 1x');

    // Enter value
    await page.fill('input[placeholder*="Digite o valor"]', '100,50');

    // Try to add without selecting link
    await page.click('button:has-text("Adicionar")');

    // Check error message
    await expect(page.locator('text=Informe se é link (Sim/Não)')).toBeVisible();
  });

  test('should successfully add a debit launch', async ({ page }) => {
    // Select debit payment method
    await page.click('text=Débito');

    // Enter value
    await page.fill('input[placeholder*="Digite o valor"]', '100,50');

    // Add launch
    await page.click('button:has-text("Adicionar")');

    // Check success message
    await expect(page.locator('text=Lançamento criado e enviado para Conferência de Caixa')).toBeVisible();

    // Check that input is cleared
    await expect(page.locator('input[placeholder*="Digite o valor"]')).toHaveValue('');
  });

  test('should successfully add a credit card launch with link', async ({ page }) => {
    // Select credit card
    await page.click('text=Cartão de Crédito 2x');

    // Select link option
    await page.click('button:has-text("Sim")');

    // Enter value
    await page.fill('input[placeholder*="Digite o valor"]', '250,75');

    // Add launch
    await page.click('button:has-text("Adicionar")');

    // Check success message
    await expect(page.locator('text=Lançamento criado e enviado para Conferência de Caixa')).toBeVisible();
  });

  test('should display launch in table', async ({ page }) => {
    // Add a launch first
    await page.click('text=Dinheiro');
    await page.fill('input[placeholder*="Digite o valor"]', '50,00');
    await page.click('button:has-text("Adicionar")');

    // Wait for success message to disappear
    await page.waitForTimeout(1000);

    // Check table has the launch
    await expect(page.locator('table')).toContainText('Dinheiro');
    await expect(page.locator('table')).toContainText('R$ 50,00');
  });

  test('should show undo button and modal', async ({ page }) => {
    // Add a launch first
    await page.click('text=Moedas');
    await page.fill('input[placeholder*="Digite o valor"]', '25,50');
    await page.click('button:has-text("Adicionar")');

    // Wait for launch to appear in table
    await page.waitForTimeout(1000);

    // Click undo button
    await page.click('button:has-text("Desfazer")');

    // Check modal appears
    await expect(page.locator('text=Confirmar Desfazer')).toBeVisible();
    await expect(page.locator('text=Tem certeza que deseja desfazer este lançamento?')).toBeVisible();

    // Check modal shows launch details
    await expect(page.locator('text=Tipo: Moedas')).toBeVisible();
    await expect(page.locator('text=Valor: R$ 25,50')).toBeVisible();
  });

  test('should undo launch when confirmed', async ({ page }) => {
    // Add a launch first
    await page.click('text=Depósito');
    await page.fill('input[placeholder*="Digite o valor"]', '150,00');
    await page.click('button:has-text("Adicionar")');

    // Wait for launch to appear
    await page.waitForTimeout(1000);

    // Click undo and confirm
    await page.click('button:has-text("Desfazer")');
    await page.click('button:has-text("Confirmar")');

    // Check success message
    await expect(page.locator('text=Lançamento desfeito com sucesso')).toBeVisible();

    // Check table is empty again
    await expect(page.locator('text=Nenhum lançamento registrado')).toBeVisible();
  });

  test('should filter launches by date', async ({ page }) => {
    // Add a launch
    await page.click('text=Débito');
    await page.fill('input[placeholder*="Digite o valor"]', '75,25');
    await page.click('button:has-text("Adicionar")');

    // Change date filter
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    await page.fill('input[type="date"]', tomorrowStr);
    await page.click('button:has-text("Aplicar")');

    // Should show no launches for tomorrow
    await expect(page.locator('text=Nenhum lançamento encontrado')).toBeVisible();
  });

  test('should use keyboard shortcuts', async ({ page }) => {
    // Select payment method
    await page.click('text=Débito');

    // Focus input and type
    await page.click('input[placeholder*="Digite o valor"]');
    await page.keyboard.type('88,88');

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Check success message
    await expect(page.locator('text=Lançamento criado e enviado para Conferência de Caixa')).toBeVisible();
  });

  test('should validate numeric input', async ({ page }) => {
    // Select payment method
    await page.click('text=Débito');

    // Try invalid value
    await page.fill('input[placeholder*="Digite o valor"]', 'abc');
    await page.click('button:has-text("Adicionar")');

    // Check error message
    await expect(page.locator('text=Digite um valor válido maior que zero')).toBeVisible();
  });
});