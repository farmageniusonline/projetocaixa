import { test, expect } from '@playwright/test';

test('debug login form behavior', async ({ page }) => {
  console.log('Starting debug login test...');

  // Navigate to login page
  await page.goto('/');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Take initial screenshot
  await page.screenshot({ path: 'debug-login-initial.png', fullPage: true });

  // Find and fill the form
  const usernameInput = await page.locator('input[name="username"]');
  const passwordInput = await page.locator('input[name="password"]');
  const submitButton = await page.locator('button[type="submit"]');

  // Verify form elements exist
  await expect(usernameInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeVisible();

  console.log('Form elements found');

  // Fill with incorrect credentials
  await usernameInput.fill('wrong_user');
  await passwordInput.fill('wrong_pass');

  // Take screenshot before submit
  await page.screenshot({ path: 'debug-login-before-submit.png', fullPage: true });

  // Setup console listener to capture logs
  page.on('console', msg => {
    console.log(`Browser console: ${msg.text()}`);
  });

  // Click submit
  console.log('Clicking submit button...');
  await submitButton.click();

  // Wait a bit for any processing
  await page.waitForTimeout(3000);

  // Take screenshot after submit
  await page.screenshot({ path: 'debug-login-after-submit.png', fullPage: true });

  // Check all possible error message locations
  const allText = await page.textContent('body');
  console.log('Page text after login attempt:', allText);

  // Look for any red elements (error styling)
  const redElements = await page.locator('.text-red-400, .text-red-500, .bg-red-900, [class*="red"]').all();
  console.log(`Found ${redElements.length} red elements`);

  for (let i = 0; i < redElements.length; i++) {
    const text = await redElements[i].textContent();
    console.log(`Red element ${i}: "${text}"`);
  }

  // Look for role="alert"
  const alertElements = await page.locator('[role="alert"]').all();
  console.log(`Found ${alertElements.length} alert elements`);

  for (let i = 0; i < alertElements.length; i++) {
    const text = await alertElements[i].textContent();
    console.log(`Alert element ${i}: "${text}"`);
  }

  // Check if we're still on login page or redirected
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Check if login button is still there or changed
  const buttonText = await submitButton.textContent();
  console.log('Submit button text:', buttonText);

  // Check for any error divs
  const errorDivs = await page.locator('div:has-text("Senha"), div:has-text("Usuario"), div:has-text("Incorret")').all();
  console.log(`Found ${errorDivs.length} potential error divs`);

  for (let i = 0; i < errorDivs.length; i++) {
    const text = await errorDivs[i].textContent();
    console.log(`Error div ${i}: "${text}"`);
  }

  console.log('Debug test completed');
});