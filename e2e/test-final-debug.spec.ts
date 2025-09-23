import { test, expect, Page } from '@playwright/test';

test.describe('Debug Final - Problema de Transferência', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capturar TODOS os logs
    page.on('console', msg => {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:5175/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('debug completo do problema', async () => {
    console.log('🔍 INICIANDO DEBUG COMPLETO...');

    // 1. Verificar se estamos na página correta
    const url = await page.url();
    console.log(`📍 URL atual: ${url}`);

    // 2. Ir para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // 3. Capturar screenshot inicial
    await page.screenshot({ path: 'debug-1-initial-state.png', fullPage: true });

    // 4. Injetar dados e forçar re-render
    console.log('💉 Injetando dados no localStorage...');
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
            rowIndex: 0
          }
        ],
        errors: [],
        warnings: [],
        stats: { totalRows: 1, validRows: 1, totalValue: 815 }
      };

      window.localStorage.setItem('dashboard_parse_result', JSON.stringify(testData));
      window.localStorage.setItem('dashboard_transferred_ids', JSON.stringify([]));

      console.log('✅ Dados injetados no localStorage');
    });

    // 5. Forçar reload completo
    console.log('🔄 Recarregando página...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Aguardar mais tempo

    // 6. Ir para Conferência Bancária novamente
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(3000);

    // 7. Capturar screenshot após reload
    await page.screenshot({ path: 'debug-2-after-reload.png', fullPage: true });

    // 8. Verificar se logs do Dashboard apareceram
    await page.waitForTimeout(2000);

    // 9. Procurar por qualquer indicação de dados na página
    const pageText = await page.textContent('body');
    const hasAnyData = pageText?.includes('815') ||
                       pageText?.includes('PIX') ||
                       pageText?.includes('Pagamento') ||
                       pageText?.includes('row_0');

    console.log(`📊 Página contém dados: ${hasAnyData}`);

    // 10. Verificar elementos da tabela
    const allElements = await page.$$('*');
    console.log(`🔍 Total de elementos na página: ${allElements.length}`);

    const tableElements = await page.$$('table, tbody, tr, .table, .row, [data-testid*="table"], [data-testid*="row"]');
    console.log(`📋 Elementos de tabela encontrados: ${tableElements.length}`);

    // 11. Verificar se o componente VirtualizedDataTable está presente
    const virtualizedElements = await page.$$('[class*="virtualized"], [class*="virtual"], [class*="list"]');
    console.log(`🖼️ Elementos virtualizados: ${virtualizedElements.length}`);

    // 12. Executar JavaScript para verificar estado React
    const reactState = await page.evaluate(() => {
      return {
        localStorage_parseResult: window.localStorage.getItem('dashboard_parse_result'),
        localStorage_transferredIds: window.localStorage.getItem('dashboard_transferred_ids'),
        hasReactDevTools: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined',
        windowKeys: Object.keys(window).filter(key => key.includes('react') || key.includes('React')).slice(0, 10)
      };
    });

    console.log('🔍 Estado do React:', JSON.stringify(reactState, null, 2));

    // 13. Tentar encontrar qualquer input de conferência
    const inputs = await page.$$('input');
    console.log(`📝 Total de inputs: ${inputs.length}`);

    for (let i = 0; i < inputs.length; i++) {
      const placeholder = await inputs[i].getAttribute('placeholder');
      const type = await inputs[i].getAttribute('type');
      const className = await inputs[i].getAttribute('class');
      console.log(`  Input ${i}: type="${type}", placeholder="${placeholder}", class="${className}"`);
    }

    // 14. Se encontrou input de conferência, testar transferência
    const conferenceInput = await page.$('input[placeholder*="Digite"], input[placeholder*="valor"], input[placeholder*="Conferir"]');
    if (conferenceInput) {
      console.log('🎯 Campo de conferência encontrado! Testando transferência...');

      await conferenceInput.fill('815');
      await conferenceInput.press('Enter');
      await page.waitForTimeout(3000);

      // Verificar se algo mudou
      const newTransferredIds = await page.evaluate(() => {
        return window.localStorage.getItem('dashboard_transferred_ids');
      });

      console.log(`🔄 TransferredIds após tentativa: ${newTransferredIds}`);

      await page.screenshot({ path: 'debug-3-after-transfer-attempt.png', fullPage: true });
    } else {
      console.log('❌ Campo de conferência não encontrado');
    }

    // 15. Capturar HTML completo para análise
    const htmlContent = await page.content();
    require('fs').writeFileSync('debug-page-content.html', htmlContent);
    console.log('📄 HTML completo salvo em debug-page-content.html');

    // Teste sempre passa para ver todos os logs
    expect(true).toBe(true);
  });
});