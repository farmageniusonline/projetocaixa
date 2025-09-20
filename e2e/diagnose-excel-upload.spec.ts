import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Diagnose Excel Upload Issue', () => {
  test('should debug Excel file upload process', async ({ page }) => {
    // Capture all console messages for debugging
    const consoleMessages: string[] = [];
    const errorMessages: string[] = [];

    page.on('console', msg => {
      const message = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(message);
      console.log(message);
    });

    page.on('pageerror', error => {
      const errorMsg = `[PAGE ERROR] ${error.message}`;
      errorMessages.push(errorMsg);
      console.error(errorMsg);
    });

    // Navigate to the application
    console.log('🚀 Navigating to application...');
    await page.goto('http://localhost:5175');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if login form is visible
    const loginForm = page.locator('form');
    if (await loginForm.isVisible()) {
      console.log('🔐 Login form detected, logging in...');

      // Fill login credentials
      // Login credentials removed for security
      // Password removed for security

      // Submit login
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForLoadState('networkidle');
    }

    // Wait for dashboard to load
    console.log('📊 Waiting for dashboard...');
    await page.waitForSelector('text=Conferência Bancária', { timeout: 10000 });

    // Click on Banking Conference tab
    console.log('🏦 Clicking on Banking Conference tab...');
    await page.click('text=Conferência Bancária');

    // Wait for the tab content to load
    await page.waitForTimeout(1000);

    // Check current state before upload
    console.log('📋 Checking current UI state...');

    // Look for file upload label (input is hidden, we click on label)
    const fileLabel = page.locator('label[for="fileInput"]');
    await expect(fileLabel).toBeVisible();
    console.log('✅ File upload label found');

    // Also check the hidden input exists
    const fileInput = page.locator('input[type="file"]#fileInput');
    await expect(fileInput).toBeAttached();
    console.log('✅ Hidden file input exists');

    // Test with CSV file first
    console.log('📄 Testing with CSV file first...');
    const csvFilePath = path.join(process.cwd(), 'exemplo', 'teste_simples.csv');

    try {
      await fileInput.setInputFiles(csvFilePath);
      console.log('✅ CSV file selected');

      // Wait a bit for file processing
      await page.waitForTimeout(2000);

      // Look for load button and click it
      const loadButton = page.locator('button', { hasText: /carregar|load/i });
      if (await loadButton.isVisible()) {
        console.log('🔄 Clicking load button...');
        await loadButton.click();

        // Wait for processing
        await page.waitForTimeout(5000);

        // Check if data table appeared
        const dataTable = page.locator('[data-testid="data-table"], .virtualized-table, table');
        const hasTable = await dataTable.isVisible();
        console.log(`📊 Data table visible: ${hasTable}`);

        if (hasTable) {
          const rowCount = await dataTable.locator('tr, [role="row"]').count();
          console.log(`📊 Rows found: ${rowCount}`);
        }
      }

    } catch (error) {
      console.error('❌ Error with CSV file:', error);
    }

    // Clear and test with XLS file
    console.log('🧹 Clearing and testing with XLS file...');

    // Look for clear button
    const clearButton = page.locator('button', { hasText: /limpar|clear/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(1000);
    }

    // Test with XLS file
    console.log('📊 Testing with XLS file...');
    const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');

    try {
      await fileInput.setInputFiles(xlsFilePath);
      console.log('✅ XLS file selected');

      // Wait a bit for file processing
      await page.waitForTimeout(2000);

      // Look for load button and click it
      const loadButtonXls = page.locator('button', { hasText: /carregar|load/i });
      if (await loadButtonXls.isVisible()) {
        console.log('🔄 Clicking load button for XLS...');
        await loadButtonXls.click();

        // Wait longer for XLS processing
        await page.waitForTimeout(10000);

        // Check if data table appeared
        const dataTableXls = page.locator('[data-testid="data-table"], .virtualized-table, table');
        const hasTableXls = await dataTableXls.isVisible();
        console.log(`📊 Data table visible after XLS: ${hasTableXls}`);

        if (hasTableXls) {
          const rowCountXls = await dataTableXls.locator('tr, [role="row"]').count();
          console.log(`📊 XLS Rows found: ${rowCountXls}`);
        } else {
          // Check for error messages
          const errorElement = page.locator('.text-red-400, .text-red-300, [class*="error"]');
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            console.error(`❌ Error message found: ${errorText}`);
          }

          // Check if still showing "no file loaded" message
          const noFileMessage = page.locator('text=nenhum arquivo, text=Conferência Bancária');
          if (await noFileMessage.isVisible()) {
            console.log('📭 Still showing "no file loaded" message');
          }
        }
      }

    } catch (error) {
      console.error('❌ Error with XLS file:', error);
    }

    // Final analysis
    console.log('\n📋 FINAL ANALYSIS:');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Total errors: ${errorMessages.length}`);

    // Show relevant console messages
    const relevantMessages = consoleMessages.filter(msg =>
      msg.includes('Worker:') ||
      msg.includes('Dashboard:') ||
      msg.includes('VirtualizedDataTable:') ||
      msg.includes('parseResult') ||
      msg.includes('error') ||
      msg.includes('Error')
    );

    console.log('\n🔍 RELEVANT CONSOLE MESSAGES:');
    relevantMessages.forEach(msg => console.log(msg));

    if (errorMessages.length > 0) {
      console.log('\n❌ ERROR MESSAGES:');
      errorMessages.forEach(msg => console.log(msg));
    }

    // Take a screenshot for visual debugging
    await page.screenshot({ path: 'debug-excel-upload.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-excel-upload.png');
  });
});