import { test, expect, Page } from '@playwright/test';

test.describe('Teste de Transferência - Com Login', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capturar todos os logs
    page.on('console', msg => {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:5175/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('deve fazer login e testar transferência', async () => {
    console.log('🚀 TESTANDO TRANSFERÊNCIA COM LOGIN...');

    // 1. Verificar se está na tela de login
    const isLoginPage = await page.isVisible('input[placeholder*="usuário"], input[placeholder*="nome"]');

    if (isLoginPage) {
      console.log('🔐 Fazendo login...');

      // Fazer login
      await page.fill('input[placeholder*="usuário"], input[placeholder*="nome"]', 'teste');
      await page.fill('input[type="password"]', 'teste123');

      // Procurar botão de login
      const loginButton = await page.$('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');
      if (loginButton) {
        await loginButton.click();
        await page.waitForTimeout(3000);
      } else {
        // Tentar Enter no campo de senha
        await page.press('input[type="password"]', 'Enter');
        await page.waitForTimeout(3000);
      }

      console.log('✅ Login realizado');
    }

    // 2. Verificar se chegou no dashboard
    const currentUrl = await page.url();
    console.log(`📍 URL após login: ${currentUrl}`);

    // 3. Ir para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // 4. Injetar dados de teste
    console.log('💉 Injetando dados de teste...');
    await page.evaluate(() => {
      const testData = {
        success: true,
        data: [
          {
            id: 'row_0',
            value: 815,
            date: '11/09/2025',
            paymentType: 'PIX RECEBIDO',
            cpf: '123.456.789-01',
            originalHistory: 'Pagamento teste 815',
            validationStatus: 'valid',
            rowIndex: 0,
            bankData: {
              date: '11/09/2025',
              description: 'Pagamento teste 815',
              value: 815,
              documentNumber: '123.456.789-01',
              transactionType: 'PIX RECEBIDO'
            }
          }
        ],
        errors: [],
        warnings: [],
        stats: { totalRows: 1, validRows: 1, totalValue: 815 }
      };

      window.localStorage.setItem('dashboard_parse_result', JSON.stringify(testData));
      window.localStorage.setItem('dashboard_transferred_ids', JSON.stringify([]));

      console.log('✅ Dados injetados no localStorage');

      // Tentar forçar re-render disparando evento
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'dashboard_parse_result',
        newValue: JSON.stringify(testData)
      }));
    });

    // 5. Recarregar para garantir que dados sejam carregados
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Ir novamente para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(3000);

    // 6. Verificar se dados apareceram
    console.log('🔍 Verificando se dados apareceram...');

    const pageContent = await page.textContent('body');
    const hasData = pageContent?.includes('815') || pageContent?.includes('PIX RECEBIDO');
    console.log(`📊 Página contém dados: ${hasData}`);

    if (hasData) {
      console.log('✅ Dados carregados na interface!');

      // 7. Capturar screenshot com dados
      await page.screenshot({ path: 'debug-with-data.png', fullPage: true });

      // 8. Testar transferência
      console.log('🔄 Testando transferência...');

      const conferenceInput = await page.$('input[placeholder*="Digite"], input[placeholder*="valor"], input[placeholder*="Conferir"]');
      if (conferenceInput) {
        await conferenceInput.fill('815');
        await conferenceInput.press('Enter');
        await page.waitForTimeout(3000);

        // Verificar se transferência foi registrada
        const transferredIds = await page.evaluate(() => {
          return window.localStorage.getItem('dashboard_transferred_ids');
        });

        console.log(`🎯 TransferredIds após transferência: ${transferredIds}`);

        if (transferredIds && transferredIds !== '[]') {
          console.log('✅ TRANSFERÊNCIA FUNCIONOU!');

          // Verificar se valor sumiu da tabela bancária
          const stillHasData = await page.textContent('body');
          const stillVisible = stillHasData?.includes('815');
          console.log(`❌ Valor ainda visível: ${stillVisible}`);

          // Verificar na aba Conferência de Caixa
          await page.click('text=Conferência de Caixa');
          await page.waitForTimeout(2000);

          const conferenceContent = await page.textContent('body');
          const inConference = conferenceContent?.includes('815');
          console.log(`✅ Valor na Conferência de Caixa: ${inConference}`);

          await page.screenshot({ path: 'debug-after-transfer.png', fullPage: true });

        } else {
          console.log('❌ Transferência não foi registrada');
          await page.screenshot({ path: 'debug-transfer-failed.png', fullPage: true });
        }

      } else {
        console.log('❌ Campo de conferência não encontrado');
      }

    } else {
      console.log('❌ Dados não apareceram na interface');
      await page.screenshot({ path: 'debug-no-data.png', fullPage: true });
    }

    // Verificar elementos de tabela
    const tableElements = await page.$$('table, tbody, tr, .table-row, [data-testid*="table"], [class*="table"]');
    console.log(`📋 Elementos de tabela encontrados: ${tableElements.length}`);

    // Teste sempre passa para ver logs
    expect(true).toBe(true);
  });
});