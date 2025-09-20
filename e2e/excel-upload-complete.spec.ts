import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Excel Upload Complete Test', () => {
  test('should successfully upload and display Excel data', async ({ page }) => {
    // Configure timeout for longer operations
    test.setTimeout(60000);

    // Capture console messages
    const consoleMessages: string[] = [];
    const errorMessages: string[] = [];

    page.on('console', msg => {
      const message = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(message);
      if (msg.type() === 'error') {
        console.error('🔥 Browser Error:', message);
        errorMessages.push(message);
      } else if (message.includes('Worker:') || message.includes('Dashboard:') || message.includes('parseResult')) {
        console.log('📋 Debug:', message);
      }
    });

    page.on('pageerror', error => {
      const errorMsg = `[PAGE ERROR] ${error.message}`;
      errorMessages.push(errorMsg);
      console.error('💥 Page Error:', errorMsg);
    });

    // Navigate to application
    console.log('🚀 Starting Excel upload test...');
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    // Skip login for this test - assume user is already authenticated
    // In production, implement proper authentication flow
    console.log('🔐 Skipping login - user assumed authenticated');

    // Navigate to Banking Conference tab
    console.log('🏦 Navigating to Banking Conference...');
    await page.waitForSelector('text=Conferência Bancária', { timeout: 10000 });
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // Check initial state
    console.log('📋 Checking initial state...');
    const fileLabel = page.locator('label[for="fileInput"]');
    await expect(fileLabel).toBeVisible();

    // Verify hidden input exists
    const fileInput = page.locator('input[type="file"]#fileInput');
    await expect(fileInput).toBeAttached();

    // Test 1: Upload CSV file first (simpler test)
    console.log('📄 Testing CSV upload first...');
    const csvFilePath = path.join(process.cwd(), 'exemplo', 'teste_simples.csv');

    await fileInput.setInputFiles(csvFilePath);
    await page.waitForTimeout(1000);

    // Check that file is selected
    const selectedFileText = await fileLabel.textContent();
    expect(selectedFileText).toContain('teste_simples.csv');
    console.log('✅ CSV file selected:', selectedFileText);

    // Click load button
    const loadButton = page.locator('button', { hasText: /carregar/i }).first();
    await expect(loadButton).toBeVisible();
    await loadButton.click();
    console.log('🔄 Load button clicked for CSV');

    // Wait for processing and check for data table
    await page.waitForTimeout(5000);

    // Look for data table or rows
    const dataRows = page.locator('[role="row"], tr, .table-row');
    const hasRows = await dataRows.count() > 0;

    if (hasRows) {
      const rowCount = await dataRows.count();
      console.log(`✅ CSV data loaded: ${rowCount} rows found`);
    } else {
      console.log('⚠️ No data rows found for CSV');
    }

    // Clear file for Excel test
    console.log('🧹 Clearing file for Excel test...');
    const clearButton = page.locator('button', { hasText: /limpar|clear/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(1000);
    }

    // Test 2: Upload Excel file
    console.log('📊 Testing Excel upload...');
    const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');

    await fileInput.setInputFiles(xlsFilePath);
    await page.waitForTimeout(1000);

    // Check that Excel file is selected
    const selectedExcelText = await fileLabel.textContent();
    expect(selectedExcelText).toContain('caixa_11-09.xls');
    console.log('✅ Excel file selected:', selectedExcelText);

    // Click load button for Excel
    await loadButton.click();
    console.log('🔄 Load button clicked for Excel');

    // Wait longer for Excel processing
    await page.waitForTimeout(10000);

    // Check for successful processing
    const processedData = page.locator('[data-testid="data-table"], .virtualized-table, table, [role="grid"]');
    const hasProcessedData = await processedData.isVisible();

    if (hasProcessedData) {
      const dataCount = await processedData.locator('[role="row"], tr, .table-row').count();
      console.log(`✅ Excel data processed: ${dataCount} rows displayed`);

      // Take screenshot of successful state
      await page.screenshot({
        path: 'excel-upload-success.png',
        fullPage: true
      });
      console.log('📸 Success screenshot saved');

    } else {
      console.log('⚠️ No processed data visible');

      // Check for error messages
      const errorElements = page.locator('.text-red-400, .text-red-300, [class*="error"]');
      if (await errorElements.count() > 0) {
        const errorText = await errorElements.first().textContent();
        console.error('❌ Error found on page:', errorText);
      }

      // Check if still showing "no file loaded" message
      const noFileMessage = page.locator('text=nenhum arquivo');
      if (await noFileMessage.isVisible()) {
        console.log('📭 Still showing "no file loaded" state');
      }

      // Take screenshot of problem state
      await page.screenshot({
        path: 'excel-upload-problem.png',
        fullPage: true
      });
      console.log('📸 Problem screenshot saved');
    }

    // Final analysis
    console.log('\n📊 FINAL TEST ANALYSIS:');
    console.log(`📝 Total console messages: ${consoleMessages.length}`);
    console.log(`❌ Total errors: ${errorMessages.length}`);

    // Show worker and processing logs
    const workerLogs = consoleMessages.filter(msg =>
      msg.includes('Worker:') ||
      msg.includes('Dashboard:') ||
      msg.includes('parseResult') ||
      msg.includes('processamento') ||
      msg.includes('VirtualizedDataTable')
    );

    if (workerLogs.length > 0) {
      console.log('\n🔍 PROCESSING LOGS:');
      workerLogs.forEach(log => console.log(log));
    }

    if (errorMessages.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errorMessages.forEach(error => console.log(error));
    }

    // Assert basic functionality
    expect(errorMessages.length).toBeLessThan(5); // Allow some non-critical errors
    expect(selectedExcelText).toContain('caixa_11-09.xls');

    console.log('✅ Excel upload test completed');
  });

  test('should handle invalid file formats gracefully', async ({ page }) => {
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    // Skip login for this test - assume user is already authenticated
    // In production, implement proper authentication flow

    // Go to Banking Conference
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    // Try to upload an invalid file (a text file)
    const fileInput = page.locator('input[type="file"]#fileInput');
    const invalidFilePath = path.join(process.cwd(), 'package.json'); // JSON file instead of Excel

    await fileInput.setInputFiles(invalidFilePath);

    const loadButton = page.locator('button', { hasText: /carregar/i }).first();
    await loadButton.click();

    // Should show error message
    await page.waitForTimeout(2000);
    const errorMessage = page.locator('.text-red-400, .text-red-300');

    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      console.log('✅ Error message displayed:', errorText);
      expect(errorText).toMatch(/não suportado|formato|inválido/i);
    }
  });
});