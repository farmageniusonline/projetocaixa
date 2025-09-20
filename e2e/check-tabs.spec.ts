import { test, expect } from '@playwright/test';

test('Check tab names', async ({ page }) => {
  await page.goto('http://localhost:5175');

  // Wait for the page to load
  await page.waitForTimeout(2000);

  // Check if we're on the login page
  const loginForm = page.locator('form');
  const loginExists = await loginForm.count();

  if (loginExists > 0) {
    console.log('Login form found, attempting to login...');

    // Try to find username field and fill it
    const usernameField = page.locator('input[type="text"], input[type="email"], input[placeholder*="usuário"], input[placeholder*="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();

    await usernameField.fill('admin');
    await passwordField.fill('admin123');

    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")').first();
    await submitButton.click();

    // Wait for navigation to dashboard
    await page.waitForTimeout(3000);
  }

  // Take a screenshot to see current state
  await page.screenshot({ path: 'tab-names-check.png', fullPage: true });

  // Look for tab buttons
  const tabs = await page.locator('button').filter({ hasText: /Conferência|Relatório|Ações|Backup|Caixa/ }).all();

  console.log('Found tabs:');
  for (const tab of tabs) {
    const text = await tab.textContent();
    console.log('Tab text:', text);
  }

  // Specifically check for "Relatório Diário" tab
  const relatorioTab = page.locator('button:has-text("Relatório Diário")');
  const tabExists = await relatorioTab.count();
  console.log('Relatório Diário tab exists:', tabExists > 0);

  if (tabExists > 0) {
    console.log('✅ Found "Relatório Diário" tab');
  } else {
    console.log('❌ "Relatório Diário" tab not found');

    // Check what tabs actually exist
    const allButtons = await page.locator('button').all();
    console.log('All button texts:');
    for (const button of allButtons) {
      const text = await button.textContent();
      if (text && text.trim()) {
        console.log('-', text.trim());
      }
    }
  }
});