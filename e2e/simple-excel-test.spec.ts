import { test, expect } from '@playwright/test';
import path from 'path';

test('Simple Excel upload test', async ({ page }) => {
  // Navigate and login
  await page.goto('http://localhost:5175');
  await page.waitForLoadState('networkidle');

  // Skip login for this test - assume user is already authenticated
  // In production, implement proper authentication flow

  // Go to Banking Conference
  await page.click('text=Conferência Bancária');
  await page.waitForTimeout(2000);

  // Upload Excel file
  const fileInput = page.locator('input[type="file"]#fileInput');
  const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');
  await fileInput.setInputFiles(xlsFilePath);

  // Check file selected
  const fileLabel = page.locator('label[for="fileInput"]');
  const labelText = await fileLabel.textContent();
  expect(labelText).toContain('caixa_11-09.xls');
  console.log('✅ File selected:', labelText);

  // Click load button
  const loadButton = page.locator('button', { hasText: /carregar/i }).first();
  await loadButton.click();
  console.log('🔄 Load button clicked');

  // Wait for processing
  await page.waitForTimeout(15000);

  // Check if processing completed without DataCloneError
  const errorElements = page.locator('div:has-text("DataCloneError")');
  const hasDataCloneError = await errorElements.count() > 0;
  expect(hasDataCloneError).toBe(false);
  console.log('✅ No DataCloneError found');

  // Take screenshot
  await page.screenshot({ path: 'excel-upload-result.png', fullPage: true });
  console.log('📸 Screenshot saved');
});