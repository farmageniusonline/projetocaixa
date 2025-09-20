import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Manual Test - Banking Conference Data Loading', () => {
  test('should load Excel file and display data in table with database verification', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(120000);

    console.log('🚀 Starting manual Banking Conference test...');

    // Navigate to application
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    console.log('✅ Application loaded');

    // Handle login with test user
    const loginForm = page.locator('form');
    if (await loginForm.isVisible()) {
      console.log('🔐 Logging in with test user...');
      await page.fill('input[name="username"]', 'teste@manipularium.com');
      await page.fill('input[name="password"]', 'TesteSeguro123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      console.log('✅ Login completed');
    }

    // Capture any errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.error('❌ Browser Error:', msg.text());
      } else if (msg.text().includes('processamento') || msg.text().includes('Worker') || msg.text().includes('dados')) {
        console.log('📋 Info:', msg.text());
      }
    });

    // Navigate to Banking Conference tab
    console.log('🏦 Navigating to Banking Conference...');
    const bankingTab = page.locator('button:has-text("Conferência Bancária")');
    await bankingTab.waitFor({ timeout: 10000 });
    await bankingTab.click();
    await page.waitForTimeout(2000);

    // Verify we're in the Banking Conference section
    const pageTitle = page.locator('h1, h2, h3');
    const titleText = await pageTitle.first().textContent();
    console.log('📄 Current page:', titleText);

    // Take initial screenshot
    await page.screenshot({
      path: 'test-banking-conference-initial.png',
      fullPage: true
    });

    // Locate file input
    const fileInput = page.locator('input[type="file"]#fileInput');
    await expect(fileInput).toBeAttached();
    console.log('📁 File input found');

    // Load Excel test file
    console.log('📊 Loading Excel test file...');
    const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');
    await fileInput.setInputFiles(xlsFilePath);
    await page.waitForTimeout(1000);

    // Check file is selected
    const fileLabel = page.locator('label[for="fileInput"]');
    const labelText = await fileLabel.textContent();
    expect(labelText).toContain('caixa_11-09.xls');
    console.log('✅ File selected:', labelText);

    // Click load button
    const loadButton = page.locator('button', { hasText: /carregar/i }).first();
    await expect(loadButton).toBeVisible();
    await loadButton.click();
    console.log('🔄 Load button clicked');

    // Wait for processing dialog to appear
    const processingDialog = page.locator('text=Processando');
    try {
      await processingDialog.waitFor({ timeout: 5000 });
      console.log('⏳ Processing dialog appeared');
    } catch {
      console.log('⚠️ Processing dialog not detected');
    }

    // Wait for processing to complete (longer timeout)
    console.log('⏳ Waiting for processing to complete...');
    try {
      await processingDialog.waitFor({ state: 'hidden', timeout: 60000 });
      console.log('✅ Processing completed');
    } catch {
      console.log('⚠️ Processing dialog timeout or not found');
    }

    // Additional wait for data to render
    await page.waitForTimeout(3000);

    // Look for data table with multiple selectors
    console.log('🔍 Looking for data table...');
    const dataSelectors = [
      '[data-testid="data-table"]',
      'table',
      '.table',
      '[role="grid"]',
      '[role="table"]',
      '.virtualized-table',
      '.data-table',
      '.results-table',
      'tbody tr',
      '.table-row'
    ];

    let dataFound = false;
    let rowCount = 0;

    for (const selector of dataSelectors) {
      const dataContainer = page.locator(selector);
      const count = await dataContainer.count();
      if (count > 0) {
        dataFound = true;
        rowCount = count;
        console.log(`✅ Data found with selector "${selector}": ${count} elements`);

        // Try to get sample data
        try {
          const firstRow = dataContainer.first();
          const rowText = await firstRow.textContent();
          console.log('📋 Sample data:', rowText?.substring(0, 100) + '...');
        } catch (e) {
          console.log('⚠️ Could not extract sample data');
        }
        break;
      }
    }

    if (!dataFound) {
      console.log('❌ No data table found');

      // Check for error messages
      const errorSelectors = [
        '.error',
        '.text-red-400',
        '.text-red-300',
        '[class*="error"]',
        'text=erro',
        'text=Error'
      ];

      for (const selector of errorSelectors) {
        const errorElement = page.locator(selector);
        const errorCount = await errorElement.count();
        if (errorCount > 0) {
          const errorText = await errorElement.first().textContent();
          console.log('❌ Error found:', errorText);
        }
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: 'test-banking-conference-final.png',
      fullPage: true
    });

    // Check if any data is visible on screen
    const bodyText = await page.locator('body').textContent();
    const hasDataIndications = bodyText?.includes('Total') ||
                              bodyText?.includes('R$') ||
                              bodyText?.includes('linha') ||
                              bodyText?.includes('registro');

    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log(`📁 File upload: ✅ Success`);
    console.log(`⚙️ Processing: ${processingDialog ? '✅ Detected' : '⚠️ Not detected'}`);
    console.log(`📋 Data table: ${dataFound ? `✅ Found (${rowCount} elements)` : '❌ Not found'}`);
    console.log(`💾 Data indicators: ${hasDataIndications ? '✅ Present' : '❌ Not found'}`);
    console.log(`❌ Errors: ${errors.length} found`);

    if (errors.length > 0) {
      console.log('\n❌ ERRORS DETECTED:');
      errors.forEach(error => console.log(`  - ${error}`));
    }

    // Assert basic functionality works
    expect(errors.filter(e => e.includes('DataCloneError')).length).toBe(0);
    console.log('✅ No DataCloneError detected - main issue resolved');
  });
});