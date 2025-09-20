import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Playwright Global Setup - Starting');

  // Check if development server is running
  const baseURL = config.use?.baseURL || 'http://localhost:5175';

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    console.log(`🔍 Checking if server is available at ${baseURL}`);
    await page.goto(baseURL, { timeout: 10000 });

    // Check if the app loads correctly
    const title = await page.title();
    console.log(`✅ Server is running. Page title: ${title}`);

    // Check if we can see the main app elements
    const hasManipulariumTitle = title.includes('Manipularium');
    if (!hasManipulariumTitle) {
      console.warn('⚠️ Page title doesn\'t match expected pattern');
    }

    await browser.close();
    console.log('✅ Global setup completed successfully');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw new Error(`Server is not available at ${baseURL}. Please ensure npm run dev is running.`);
  }
}

export default globalSetup;