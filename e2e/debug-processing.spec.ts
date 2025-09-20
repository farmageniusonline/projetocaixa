import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Debug Processing Flow', () => {
  test('should identify where processing gets stuck', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    console.log('🐛 Starting debug test to identify processing bottleneck...');

    // Navigate and login
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');

    const loginForm = page.locator('form');
    if (await loginForm.isVisible()) {
      await page.fill('input[name="username"]', 'teste@manipularium.com');
      await page.fill('input[name="password"]', 'TesteSeguro123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    }

    // Go to Banking Conference
    await page.click('button:has-text("Conferência Bancária")');
    await page.waitForTimeout(2000);

    // Track all console messages with timestamps
    const logs: Array<{time: number, type: string, message: string}> = [];

    page.on('console', msg => {
      const timestamp = Date.now();
      const message = msg.text();
      logs.push({
        time: timestamp,
        type: msg.type(),
        message: message
      });

      // Real-time logging of key events
      if (message.includes('Worker:') ||
          message.includes('Dashboard:') ||
          message.includes('processamento') ||
          message.includes('transaction') ||
          message.includes('database') ||
          message.includes('Supabase')) {
        console.log(`[${new Date(timestamp).toLocaleTimeString()}] ${msg.type()}: ${message}`);
      }
    });

    // Upload file
    const fileInput = page.locator('input[type="file"]#fileInput');
    const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');
    await fileInput.setInputFiles(xlsFilePath);

    const loadButton = page.locator('button', { hasText: /carregar/i }).first();

    console.log('🔄 Clicking load button and monitoring processing...');
    const startTime = Date.now();

    await loadButton.click();

    // Monitor processing for up to 2 minutes
    let lastProgressTime = startTime;
    let currentStage = 'initial';

    for (let i = 0; i < 120; i++) { // 120 seconds max
      await page.waitForTimeout(1000);
      const currentTime = Date.now();

      // Check if processing dialog exists
      const processingButton = page.locator('button:has-text("Processando")');
      const isProcessing = await processingButton.isVisible();

      if (!isProcessing && currentTime - startTime > 5000) {
        console.log('✅ Processing completed or dialog closed');
        break;
      }

      // Check for recent logs to detect stage changes
      const recentLogs = logs.filter(log => log.time > lastProgressTime);
      if (recentLogs.length > 0) {
        const stageLog = recentLogs.find(log =>
          log.message.includes('stage:') ||
          log.message.includes('processamento') ||
          log.message.includes('Worker:') ||
          log.message.includes('database')
        );

        if (stageLog) {
          console.log(`📊 Stage update: ${stageLog.message}`);
          currentStage = stageLog.message;
          lastProgressTime = currentTime;
        }
      }

      // Detect stalls (no progress for 30 seconds)
      if (currentTime - lastProgressTime > 30000) {
        console.log(`⚠️ Processing appears stalled for 30+ seconds at stage: ${currentStage}`);
        console.log(`⏰ Total time elapsed: ${Math.round((currentTime - startTime) / 1000)}s`);

        // Take screenshot of stalled state
        await page.screenshot({
          path: `debug-stalled-${i}s.png`,
          fullPage: true
        });

        break;
      }

      // Log progress every 10 seconds
      if (i % 10 === 0) {
        console.log(`⏰ ${i}s elapsed - Current stage: ${currentStage}`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n🏁 Debug session completed in ${Math.round(totalTime / 1000)}s`);

    // Analyze logs
    console.log('\n📋 LOG ANALYSIS:');

    const workerLogs = logs.filter(log => log.message.includes('Worker:'));
    const dashboardLogs = logs.filter(log => log.message.includes('Dashboard:'));
    const databaseLogs = logs.filter(log => log.message.includes('database') || log.message.includes('transaction'));
    const errorLogs = logs.filter(log => log.type === 'error');

    console.log(`Worker logs: ${workerLogs.length}`);
    console.log(`Dashboard logs: ${dashboardLogs.length}`);
    console.log(`Database logs: ${databaseLogs.length}`);
    console.log(`Error logs: ${errorLogs.length}`);

    if (workerLogs.length > 0) {
      console.log('\n🔧 WORKER LOGS:');
      workerLogs.forEach((log, i) => {
        const elapsed = Math.round((log.time - startTime) / 1000);
        console.log(`  [${elapsed}s] ${log.message}`);
      });
    }

    if (databaseLogs.length > 0) {
      console.log('\n💾 DATABASE LOGS:');
      databaseLogs.forEach((log, i) => {
        const elapsed = Math.round((log.time - startTime) / 1000);
        console.log(`  [${elapsed}s] ${log.message}`);
      });
    }

    if (errorLogs.length > 0) {
      console.log('\n❌ ERROR LOGS:');
      errorLogs.forEach((log, i) => {
        const elapsed = Math.round((log.time - startTime) / 1000);
        console.log(`  [${elapsed}s] ${log.message}`);
      });
    }

    // Final screenshot
    await page.screenshot({
      path: 'debug-final-state.png',
      fullPage: true
    });

    console.log('📸 Final screenshot saved as debug-final-state.png');
  });
});