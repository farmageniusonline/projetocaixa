import { test, expect } from '@playwright/test';

test('debug - inspect page structure', async ({ page }) => {
  console.log('🔍 Starting page structure debug...');

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Take screenshot for visual inspection
  await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
  console.log('📸 Screenshot saved to test-results/debug-page.png');

  // Get page title
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);

  // Check if page loaded
  const bodyText = await page.locator('body').textContent();
  console.log(`📝 Body contains text: ${bodyText ? 'YES' : 'NO'}`);
  console.log(`📏 Body text length: ${bodyText?.length || 0} characters`);

  // Find all h1, h2, h3 elements
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  console.log(`🏷️ Found headings:`, headings);

  // Find input elements
  const inputs = await page.locator('input').count();
  console.log(`📝 Found ${inputs} input elements`);

  // Check for file inputs specifically
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log(`📁 Found ${fileInputs} file input elements`);

  // Find buttons
  const buttons = await page.locator('button').allTextContents();
  console.log(`🔘 Found buttons:`, buttons);

  // Check for any error messages or loading states
  const errorMessages = await page.locator('text=/erro|error/i').count();
  console.log(`❌ Found ${errorMessages} error messages`);

  // Get the full HTML structure of main content
  const mainContent = await page.locator('#root').innerHTML();
  console.log(`🏗️ Root element HTML length: ${mainContent.length} characters`);

  // Check if React loaded
  const reactRoot = await page.locator('#root').count();
  console.log(`⚛️ React root found: ${reactRoot > 0 ? 'YES' : 'NO'}`);

  // Wait a bit and check again in case of lazy loading
  await page.waitForTimeout(3000);
  const postWaitHeadings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  console.log(`🏷️ Headings after 3s wait:`, postWaitHeadings);

  console.log('✅ Debug inspection complete');
});