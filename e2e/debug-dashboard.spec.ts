import { test, expect } from '@playwright/test';

test('debug - inspect dashboard after login', async ({ page }) => {
  console.log('🔍 Starting dashboard debug after login...');

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Login
  console.log('🔐 Logging in...');
  await page.fill('input[placeholder*="nome de usuário"]', 'admin');
  await page.fill('input[placeholder*="senha"]', 'manipularium');
  await page.click('button:has-text("Entrar")');
  await page.waitForLoadState('networkidle');

  // Wait a bit for dashboard to fully load
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-dashboard.png', fullPage: true });
  console.log('📸 Dashboard screenshot saved');

  // Get page info
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);

  // Find headings
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
  console.log(`🏷️ Dashboard headings:`, headings);

  // Find buttons
  const buttons = await page.locator('button').allTextContents();
  console.log(`🔘 Dashboard buttons:`, buttons);

  // Find input elements
  const inputs = await page.locator('input').count();
  console.log(`📝 Found ${inputs} input elements`);

  // Check for file inputs specifically
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log(`📁 Found ${fileInputs} file input elements`);

  // Check for tabs or navigation
  const tabs = await page.locator('[role="tab"], .tab, nav button, nav a').allTextContents();
  console.log(`🗂️ Found tabs/nav:`, tabs);

  // Check for upload-related text
  const uploadText = await page.locator('text=/upload|carregar|planilha|arquivo/i').count();
  console.log(`📤 Upload-related elements: ${uploadText}`);

  // Get main content
  const mainContent = await page.locator('#root').innerHTML();
  console.log(`🏗️ Content length: ${mainContent.length} characters`);

  // Look for specific elements that might be upload-related
  const loadButton = page.locator('button:has-text("Carregar")');
  const loadButtonCount = await loadButton.count();
  console.log(`🔄 "Carregar" buttons found: ${loadButtonCount}`);

  console.log('✅ Dashboard debug complete');
});