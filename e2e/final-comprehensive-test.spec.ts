import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('🔍 Final Comprehensive E2E Test', () => {
  test('should validate complete application functionality end-to-end', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for comprehensive test

    const testResults = {
      authentication: { status: '❌', details: '', timestamp: '' },
      navigation: { status: '❌', details: '', timestamp: '' },
      fileUpload: { status: '❌', details: '', timestamp: '' },
      dataProcessing: { status: '❌', details: '', timestamp: '' },
      errorHandling: { status: '❌', details: '', timestamp: '' },
      userInterface: { status: '❌', details: '', timestamp: '' },
      performance: { status: '❌', details: '', timestamp: '' }
    };

    const startTime = Date.now();
    console.log('🚀 INICIANDO TESTE E2E FINAL ABRANGENTE');
    console.log('=' .repeat(80));

    // ==========================================
    // 1. TESTE DE AUTENTICAÇÃO
    // ==========================================
    console.log('\n📋 1. TESTANDO AUTENTICAÇÃO...');
    try {
      await page.goto('http://localhost:5175');
      await page.waitForLoadState('networkidle');

      // Verificar se a página de login está visível
      const loginForm = page.locator('form');
      const isLoginVisible = await loginForm.isVisible();

      if (isLoginVisible) {
        await page.fill('input[name="username"]', 'teste@manipularium.com');
        await page.fill('input[name="password"]', 'TesteSeguro123');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Verificar se o login foi bem-sucedido
        const dashboardVisible = await page.locator('h1, h2, h3').isVisible();
        if (dashboardVisible) {
          testResults.authentication.status = '✅';
          testResults.authentication.details = 'Login via Supabase funcionando';
        } else {
          testResults.authentication.details = 'Login falhou - dashboard não carregou';
        }
      } else {
        testResults.authentication.status = '✅';
        testResults.authentication.details = 'Usuário já autenticado';
      }
      testResults.authentication.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.authentication.status} Autenticação: ${testResults.authentication.details}`);
    } catch (error) {
      testResults.authentication.details = `Erro: ${error}`;
      console.log(`❌ Autenticação falhou: ${error}`);
    }

    // ==========================================
    // 2. TESTE DE NAVEGAÇÃO
    // ==========================================
    console.log('\n📋 2. TESTANDO NAVEGAÇÃO...');
    try {
      // Verificar abas principais
      const bankingTab = page.locator('button:has-text("Conferência Bancária")');
      const historyTab = page.locator('button:has-text("Histórico por Data")');

      if (await bankingTab.isVisible() && await historyTab.isVisible()) {
        await bankingTab.click();
        await page.waitForTimeout(1000);

        const bankingContent = await page.locator('h3:has-text("Conferência Bancária")').isVisible();
        if (bankingContent) {
          testResults.navigation.status = '✅';
          testResults.navigation.details = 'Navegação entre abas funcionando';
        } else {
          testResults.navigation.details = 'Conteúdo da aba não carregou';
        }
      } else {
        testResults.navigation.details = 'Abas de navegação não encontradas';
      }
      testResults.navigation.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.navigation.status} Navegação: ${testResults.navigation.details}`);
    } catch (error) {
      testResults.navigation.details = `Erro: ${error}`;
      console.log(`❌ Navegação falhou: ${error}`);
    }

    // ==========================================
    // 3. TESTE DE UPLOAD DE ARQUIVO
    // ==========================================
    console.log('\n📋 3. TESTANDO UPLOAD DE ARQUIVO...');
    try {
      const fileInput = page.locator('input[type="file"]#fileInput');
      if (await fileInput.isAttached()) {
        const xlsFilePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');
        await fileInput.setInputFiles(xlsFilePath);

        const fileLabel = page.locator('label[for="fileInput"]');
        const labelText = await fileLabel.textContent();

        if (labelText && labelText.includes('caixa_11-09.xls')) {
          testResults.fileUpload.status = '✅';
          testResults.fileUpload.details = 'Upload de arquivo Excel funcionando';
        } else {
          testResults.fileUpload.details = 'Arquivo não foi selecionado corretamente';
        }
      } else {
        testResults.fileUpload.details = 'Input de arquivo não encontrado';
      }
      testResults.fileUpload.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.fileUpload.status} Upload: ${testResults.fileUpload.details}`);
    } catch (error) {
      testResults.fileUpload.details = `Erro: ${error}`;
      console.log(`❌ Upload falhou: ${error}`);
    }

    // ==========================================
    // 4. TESTE DE PROCESSAMENTO DE DADOS
    // ==========================================
    console.log('\n📋 4. TESTANDO PROCESSAMENTO DE DADOS...');
    try {
      // Monitor console logs for processing
      const processingLogs: string[] = [];
      const errorLogs: string[] = [];

      page.on('console', msg => {
        const message = msg.text();
        if (msg.type() === 'error') {
          errorLogs.push(message);
        }
        if (message.includes('Worker:') ||
            message.includes('processamento') ||
            message.includes('Dashboard:')) {
          processingLogs.push(message);
        }
      });

      const loadButton = page.locator('button', { hasText: /carregar/i }).first();
      if (await loadButton.isVisible()) {
        await loadButton.click();
        console.log('   🔄 Botão de carregamento clicado...');

        // Wait for processing to start
        await page.waitForTimeout(3000);

        const hasDataCloneError = errorLogs.some(log => log.includes('DataCloneError'));
        const hasProcessingLogs = processingLogs.length > 0;

        if (!hasDataCloneError && hasProcessingLogs) {
          testResults.dataProcessing.status = '✅';
          testResults.dataProcessing.details = `Processamento iniciado sem DataCloneError (${processingLogs.length} logs)`;
        } else if (hasDataCloneError) {
          testResults.dataProcessing.details = 'DataCloneError detectado no processamento';
        } else {
          testResults.dataProcessing.details = 'Processamento não iniciou adequadamente';
        }
      } else {
        testResults.dataProcessing.details = 'Botão de carregamento não encontrado';
      }
      testResults.dataProcessing.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.dataProcessing.status} Processamento: ${testResults.dataProcessing.details}`);

      // Show processing logs
      if (processingLogs.length > 0) {
        console.log('   📋 Logs de processamento capturados:');
        processingLogs.slice(0, 3).forEach(log => console.log(`     - ${log.substring(0, 80)}...`));
      }
    } catch (error) {
      testResults.dataProcessing.details = `Erro: ${error}`;
      console.log(`❌ Processamento falhou: ${error}`);
    }

    // ==========================================
    // 5. TESTE DE TRATAMENTO DE ERROS
    // ==========================================
    console.log('\n📋 5. TESTANDO TRATAMENTO DE ERROS...');
    try {
      // Wait for any processing to complete/timeout
      await page.waitForTimeout(10000);

      // Check for user-friendly error messages
      const errorSelectors = [
        '.text-red-400',
        '.text-red-300',
        '[class*="error"]',
        'text=erro',
        'text=Error'
      ];

      let errorMessagesFound = 0;
      for (const selector of errorSelectors) {
        const errorElements = page.locator(selector);
        const count = await errorElements.count();
        if (count > 0) {
          errorMessagesFound += count;
        }
      }

      // Check if processing dialog handles timeouts gracefully
      const processingButton = page.locator('button:has-text("Processando")');
      const isStillProcessing = await processingButton.isVisible();

      if (!isStillProcessing || errorMessagesFound > 0) {
        testResults.errorHandling.status = '✅';
        testResults.errorHandling.details = 'Sistema lida com erros e timeouts adequadamente';
      } else {
        testResults.errorHandling.details = 'Processamento pode estar travado indefinidamente';
      }

      testResults.errorHandling.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.errorHandling.status} Tratamento de Erros: ${testResults.errorHandling.details}`);
    } catch (error) {
      testResults.errorHandling.details = `Erro: ${error}`;
      console.log(`❌ Teste de erros falhou: ${error}`);
    }

    // ==========================================
    // 6. TESTE DE INTERFACE DE USUÁRIO
    // ==========================================
    console.log('\n📋 6. TESTANDO INTERFACE DE USUÁRIO...');
    try {
      // Check for main UI components
      const components = {
        sidebar: await page.locator('.sidebar, [class*="sidebar"]').isVisible(),
        header: await page.locator('header, [role="banner"]').isVisible(),
        mainContent: await page.locator('main, [role="main"]').isVisible(),
        navigation: await page.locator('nav, [role="navigation"]').isVisible()
      };

      const visibleComponents = Object.entries(components)
        .filter(([_, visible]) => visible)
        .map(([name, _]) => name);

      if (visibleComponents.length >= 2) {
        testResults.userInterface.status = '✅';
        testResults.userInterface.details = `UI principal funcionando (${visibleComponents.join(', ')})`;
      } else {
        testResults.userInterface.details = 'Componentes principais da UI não encontrados';
      }

      testResults.userInterface.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.userInterface.status} Interface: ${testResults.userInterface.details}`);
    } catch (error) {
      testResults.userInterface.details = `Erro: ${error}`;
      console.log(`❌ Teste de UI falhou: ${error}`);
    }

    // ==========================================
    // 7. TESTE DE PERFORMANCE
    // ==========================================
    console.log('\n📋 7. TESTANDO PERFORMANCE...');
    try {
      const totalTime = Date.now() - startTime;
      const performanceMetrics = await page.evaluate(() => {
        return {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        };
      });

      if (totalTime < 60000 && performanceMetrics.loadTime < 10000) {
        testResults.performance.status = '✅';
        testResults.performance.details = `Carregamento rápido (${Math.round(totalTime/1000)}s total, ${Math.round(performanceMetrics.loadTime/1000)}s DOM)`;
      } else {
        testResults.performance.details = `Performance lenta (${Math.round(totalTime/1000)}s total)`;
      }

      testResults.performance.timestamp = new Date().toLocaleTimeString();
      console.log(`${testResults.performance.status} Performance: ${testResults.performance.details}`);
    } catch (error) {
      testResults.performance.details = `Erro: ${error}`;
      console.log(`❌ Teste de performance falhou: ${error}`);
    }

    // ==========================================
    // RELATÓRIO FINAL
    // ==========================================
    const finalTime = Date.now() - startTime;

    console.log('\n' + '=' .repeat(80));
    console.log('📊 RELATÓRIO FINAL DO TESTE E2E');
    console.log('=' .repeat(80));

    const results = Object.entries(testResults);
    const passedTests = results.filter(([_, result]) => result.status === '✅').length;
    const totalTests = results.length;

    console.log(`\n⏱️  Tempo total: ${Math.round(finalTime / 1000)}s`);
    console.log(`📈 Testes aprovados: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`\n📋 Resultados detalhados:`);

    results.forEach(([category, result], index) => {
      console.log(`   ${index + 1}. ${result.status} ${category.toUpperCase()}: ${result.details}`);
      console.log(`      ⏰ ${result.timestamp}`);
    });

    console.log('\n🔍 Análise Geral:');

    if (passedTests === totalTests) {
      console.log('   ✅ SISTEMA COMPLETAMENTE FUNCIONAL');
      console.log('   🎉 Todos os testes principais passaram com sucesso');
    } else if (passedTests >= totalTests * 0.8) {
      console.log('   ⚠️  SISTEMA MAJORITARIAMENTE FUNCIONAL');
      console.log('   🔧 Pequenos ajustes podem ser necessários');
    } else if (passedTests >= totalTests * 0.5) {
      console.log('   ⚠️  SISTEMA PARCIALMENTE FUNCIONAL');
      console.log('   🛠️  Correções importantes necessárias');
    } else {
      console.log('   ❌ SISTEMA COM PROBLEMAS CRÍTICOS');
      console.log('   🚨 Revisão completa necessária');
    }

    // Take final comprehensive screenshot
    await page.screenshot({
      path: 'final-e2e-test-result.png',
      fullPage: true
    });

    console.log('\n📸 Screenshot final salvo como: final-e2e-test-result.png');
    console.log('=' .repeat(80));

    // Assert that critical functionality works
    expect(passedTests).toBeGreaterThanOrEqual(Math.floor(totalTests * 0.7)); // At least 70% should pass
    expect(testResults.authentication.status).toBe('✅'); // Authentication is critical
    expect(testResults.fileUpload.status).toBe('✅'); // File upload is critical
  });
});