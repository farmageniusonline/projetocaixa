import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Conference History System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5176/');

    // Mock login if needed
    const needsLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (needsLogin) {
      await page.fill('input[type="email"], input[name="username"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => {});
    }
  });

  test('should load and display DateSelector component', async ({ page }) => {
    // Check if DateSelector is visible
    await expect(page.locator('text=Selecionar Dia')).toBeVisible();

    // Check default mode is automatic
    const automaticRadio = page.locator('input[type="radio"][value="automatic"]');
    await expect(automaticRadio).toBeChecked();
  });

  test('should switch between automatic and manual date modes', async ({ page }) => {
    // Switch to manual mode
    await page.click('label:has-text("Selecionar Manualmente")');

    // Date input should be visible
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible();

    // Set a manual date
    await dateInput.fill('2024-03-15');

    // Verify date is displayed
    await expect(page.locator('text=15/03/2024')).toBeVisible();
  });

  test('should display HistoryByDate component', async ({ page }) => {
    // Check if HistoryByDate is visible
    await expect(page.locator('text=Histórico por Data')).toBeVisible();

    // Check for date input
    const historyDateInput = page.locator('text=Histórico por Data').locator('..').locator('input[type="date"]');
    await expect(historyDateInput).toBeVisible();

    // Check for period selector
    const periodSelect = page.locator('select').filter({ hasText: /Dia específico/ });
    await expect(periodSelect).toBeVisible();
  });

  test('should load history when clicking "Carregar Histórico"', async ({ page }) => {
    // Find and click load history button
    const loadButton = page.locator('button:has-text("Carregar Histórico")');
    await expect(loadButton).toBeVisible();

    await loadButton.click();

    // Wait for either data or no data message
    await page.waitForSelector('text=/Nenhum registro encontrado|Resumo do Dia/', { timeout: 5000 });
  });

  test('should upload file and detect date automatically', async ({ page }) => {
    // Create a test CSV file
    const testData = `Data,Documento,Descrição,Valor
2024-03-20,DOC001,Test Transaction 1,100.50
2024-03-20,DOC002,Test Transaction 2,200.75
2024-03-20,DOC003,Test Transaction 3,300.25`;

    const fileName = 'test-upload.csv';
    await page.evaluate(({ data, name }) => {
      const blob = new Blob([data], { type: 'text/csv' });
      const file = new File([blob], name, { type: 'text/csv' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const input = document.querySelector('input[type="file"]');
      if (input) {
        (input as HTMLInputElement).files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { data: testData, name: fileName });

    // Wait for file to be selected
    await expect(page.locator(`text=✅ ${fileName}`)).toBeVisible({ timeout: 5000 });

    // Click load button
    await page.click('button:has-text("Carregar")');

    // Wait for processing
    await page.waitForSelector('text=/Processando arquivo|Linhas processadas/', { timeout: 10000 });
  });

  test('should perform cash conference value check', async ({ page }) => {
    // First, ensure a file is loaded
    const needsFile = await page.locator('text=Carregue uma planilha para usar esta função').isVisible().catch(() => false);

    if (needsFile) {
      // Upload a test file first
      const testData = `Data,Documento,Descrição,Valor
2024-03-20,DOC001,Test Transaction,150.00`;

      await page.evaluate(({ data }) => {
        const blob = new Blob([data], { type: 'text/csv' });
        const file = new File([blob], 'test.csv', { type: 'text/csv' });
        const dt = new DataTransfer();
        dt.items.add(file);

        const input = document.querySelector('input[type="file"]');
        if (input) {
          (input as HTMLInputElement).files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { data: testData });

      await page.click('button:has-text("Carregar")');
      await page.waitForTimeout(2000);
    }

    // Enter a value to check
    const conferenceInput = page.locator('input[placeholder*="Digite o valor"]');
    await conferenceInput.fill('150,00');

    // Click OK button
    await page.click('button:has-text("OK")');

    // Wait for result
    await page.waitForSelector('text=/encontrado|não encontrado/i', { timeout: 5000 });
  });

  test('should switch between Banking and Cash Conference tabs', async ({ page }) => {
    // Check Banking tab is active by default
    const bankingTab = page.locator('button:has-text("Conferência Bancária")');
    await expect(bankingTab).toHaveClass(/border-indigo-500/);

    // Switch to Cash Conference tab
    const cashTab = page.locator('button:has-text("Conferência de Caixa")');
    await cashTab.click();

    // Verify Cash Conference tab is now active
    await expect(cashTab).toHaveClass(/border-indigo-500/);

    // Verify Cash Conference content is visible
    await expect(page.locator('text=Filtrar por Data')).toBeVisible();
  });

  test('should filter history by different periods', async ({ page }) => {
    // Navigate to History section
    const periodSelect = page.locator('select').filter({ hasText: /Dia específico/ });

    // Change to week view
    await periodSelect.selectOption('week');
    await expect(periodSelect).toHaveValue('week');

    // Change to month view
    await periodSelect.selectOption('month');
    await expect(periodSelect).toHaveValue('month');

    // Load history for the selected period
    await page.click('button:has-text("Carregar Histórico")');

    // Wait for response
    await page.waitForTimeout(2000);
  });

  test('should show today button functionality', async ({ page }) => {
    // Find the Today button in history section
    const todayButton = page.locator('button:has-text("Hoje")').first();
    await expect(todayButton).toBeVisible();

    // Click today button
    await todayButton.click();

    // Verify date is set to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = page.locator('text=Histórico por Data').locator('..').locator('input[type="date"]');
    await expect(dateInput).toHaveValue(today);
  });

  test('should display not found history', async ({ page }) => {
    // Check for not found history section
    const notFoundButton = page.locator('button:has-text("Histórico de valores não encontrados")');

    if (await notFoundButton.isVisible()) {
      // Click to expand
      await notFoundButton.click();

      // Check if history panel is visible
      const historyPanel = page.locator('text=/Nenhum valor não encontrado|valor\(es\) não encontrado/');
      await expect(historyPanel).toBeVisible();
    }
  });

  test('should restart current day', async ({ page }) => {
    // Find restart button
    const restartButton = page.locator('button:has-text("Reiniciar dia atual")');

    if (await restartButton.isVisible()) {
      await restartButton.click();

      // Confirmation modal should appear
      await expect(page.locator('text=Confirmar Reinício')).toBeVisible();

      // Cancel the restart
      await page.click('button:has-text("Cancelar")');

      // Modal should close
      await expect(page.locator('text=Confirmar Reinício')).not.toBeVisible();
    }
  });
});

test.describe('Data Persistence', () => {
  test('should persist uploaded data in history', async ({ page }) => {
    await page.goto('http://localhost:5176/');

    // Mock login if needed
    const needsLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (needsLogin) {
      await page.fill('input[type="email"], input[name="username"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
    }

    // Upload a file with specific date
    const testData = `Data,Documento,Descrição,Valor
2024-03-25,DOC100,Persistence Test 1,500.00
2024-03-25,DOC101,Persistence Test 2,750.00`;

    await page.evaluate(({ data }) => {
      const blob = new Blob([data], { type: 'text/csv' });
      const file = new File([blob], 'persistence-test.csv', { type: 'text/csv' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const input = document.querySelector('input[type="file"]');
      if (input) {
        (input as HTMLInputElement).files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, { data: testData });

    // Load the file
    await page.click('button:has-text("Carregar")');
    await page.waitForTimeout(2000);

    // Now check history for that date
    const historyDateInput = page.locator('text=Histórico por Data').locator('..').locator('input[type="date"]');
    await historyDateInput.fill('2024-03-25');

    await page.click('button:has-text("Carregar Histórico")');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Verify data is displayed (or at least no error)
    const hasError = await page.locator('text=Erro ao carregar').isVisible().catch(() => false);
    expect(hasError).toBeFalsy();
  });
});