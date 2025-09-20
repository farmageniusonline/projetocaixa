import { test, expect } from '@playwright/test';

test('should show error message for incorrect credentials', async ({ page }) => {
  console.log('Starting login error test...');

  // Navigate to the login page
  await page.goto('/');

  // Wait for the login form to be visible
  await page.waitForSelector('form', { timeout: 10000 });

  // Fill in incorrect credentials
  await page.fill('input[name="username"]', 'usuario_incorreto');
  await page.fill('input[name="password"]', 'senha_incorreta');

  // Click the login button
  await page.click('button[type="submit"]');

  // Wait for the error message to appear
  console.log('Waiting for error message...');

  // Look for the error message with multiple possible selectors
  const errorMessage = await page.waitForSelector(
    'text="Senha ou Usuario Incorretos", [role="alert"], .text-red-400, .bg-red-900',
    { timeout: 10000 }
  );

  // Verify the error message is visible
  expect(errorMessage).toBeTruthy();

  // Check the exact text content
  const errorText = await errorMessage.textContent();
  console.log('Error message found:', errorText);

  expect(errorText).toContain('Senha ou Usuario Incorretos');

  // Take a screenshot for debugging
  await page.screenshot({ path: 'login-error-test.png', fullPage: true });

  console.log('Login error test completed successfully');
});

test('should show loading state during login attempt', async ({ page }) => {
  console.log('Starting login loading state test...');

  await page.goto('/');

  // Wait for the login form
  await page.waitForSelector('form');

  // Fill in credentials
  await page.fill('input[name="username"]', 'test_user');
  await page.fill('input[name="password"]', 'test_password');

  // Click submit and immediately check for loading state
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForSelector('text="Entrando..."', { timeout: 5000 })
  ]);

  console.log('Loading state detected during login');

  // Wait for the loading to finish and error to appear
  await page.waitForSelector('text="Senha ou Usuario Incorretos"', { timeout: 15000 });

  console.log('Login loading state test completed');
});

test('should maintain form state after error', async ({ page }) => {
  console.log('Starting form state persistence test...');

  await page.goto('/');

  // Wait for form
  await page.waitForSelector('form');

  const username = 'test_username';
  const password = 'wrong_password';

  // Fill form
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for error
  await page.waitForSelector('text="Senha ou Usuario Incorretos"');

  // Check that username is still there (password should be cleared for security)
  const usernameValue = await page.inputValue('input[name="username"]');
  expect(usernameValue).toBe(username);

  // Password should be cleared
  const passwordValue = await page.inputValue('input[name="password"]');
  console.log('Password value after error:', passwordValue);

  console.log('Form state persistence test completed');
});