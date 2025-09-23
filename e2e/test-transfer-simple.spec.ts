import { test, expect, Page } from '@playwright/test';

test.describe('Teste de Transferência - Simples', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Habilita console logs para debug
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'debug') {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });

    await page.goto('http://localhost:5175/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('deve verificar se o problema está na transferência de valores', async () => {
    console.log('🚀 Verificando problema de transferência...');

    // 1. Ir para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // 2. Verificar estrutura da página
    console.log('📋 Verificando estrutura da página...');

    // Procurar por diferentes seletores de input file
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`Found ${fileInputs.length} file inputs`);

    const allInputs = await page.$$('input');
    console.log(`Found ${allInputs.length} total inputs`);

    // Verificar se existem botões de upload
    const uploadButtons = await page.$$('button:has-text("Carregar"), button:has-text("Upload"), [data-testid*="upload"]');
    console.log(`Found ${uploadButtons.length} upload buttons`);

    // 3. Verificar se existe campo de conferência
    const conferenceInputs = await page.$$('input[placeholder*="Digite"], input[placeholder*="Conferir"]');
    console.log(`Found ${conferenceInputs.length} conference inputs`);

    // 4. Se temos o campo de conferência, vamos simular uma busca direta
    if (conferenceInputs.length > 0) {
      console.log('🔍 Testando busca direta sem carregar planilha...');

      // Tentar buscar um valor qualquer
      await conferenceInputs[0].fill('815');
      await conferenceInputs[0].press('Enter');
      await page.waitForTimeout(2000);

      // Verificar se aparece mensagem de erro (esperado, já que não há planilha)
      const errorMessages = await page.$$('text=Nenhuma planilha, text=Nenhum valor');
      console.log(`Found ${errorMessages.length} error messages`);

      if (errorMessages.length > 0) {
        const errorText = await errorMessages[0].textContent();
        console.log(`Error message: ${errorText}`);
      }
    }

    // 5. Capturar screenshot para debug
    await page.screenshot({ path: 'debug-page-structure.png', fullPage: true });

    // 6. Verificar localStorage para debug
    const transferredIds = await page.evaluate(() => {
      return window.localStorage.getItem('dashboard_transferred_ids');
    });
    console.log('🔍 transferredIds no localStorage:', transferredIds);

    const parseResult = await page.evaluate(() => {
      return window.localStorage.getItem('dashboard_parse_result');
    });
    console.log('🔍 parseResult no localStorage:', parseResult ? 'exists' : 'null');

    console.log('✅ Verificação de estrutura concluída');
  });

  test('deve verificar se existe dados simulados', async () => {
    console.log('🚀 Verificando se podemos simular dados...');

    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // Simular dados diretamente no localStorage
    await page.evaluate(() => {
      const mockData = {
        success: true,
        data: [
          {
            id: 'row_0',
            value: 815,
            date: '11/09/2025',
            paymentType: 'PIX RECEBIDO',
            cpf: '123.456.789-01',
            originalHistory: 'Pagamento teste 815',
            validationStatus: 'valid'
          },
          {
            id: 'row_1',
            value: 1470,
            date: '11/09/2025',
            paymentType: 'PIX RECEBIDO',
            cpf: '987.654.321-02',
            originalHistory: 'Pagamento teste 1470',
            validationStatus: 'valid'
          }
        ],
        errors: [],
        warnings: [],
        stats: { totalRows: 2, validRows: 2, totalValue: 2285 }
      };

      window.localStorage.setItem('dashboard_parse_result', JSON.stringify(mockData));
      window.localStorage.setItem('dashboard_transferred_ids', JSON.stringify([]));
    });

    // Recarregar página para carregar dados do localStorage
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Ir para Conferência Bancária novamente
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(2000);

    // Verificar se os dados aparecem na tela
    const hasValue815 = await page.isVisible('text=815,00');
    const hasValue1470 = await page.isVisible('text=1.470,00');

    console.log(`Value 815,00 visible: ${hasValue815}`);
    console.log(`Value 1470,00 visible: ${hasValue1470}`);

    if (hasValue815) {
      console.log('✅ Dados simulados carregados com sucesso!');

      // Agora testar a transferência
      console.log('🔄 Testando transferência...');

      const conferenceInput = page.locator('input[placeholder*="Digite"], input[placeholder*="Conferir"]').first();
      await conferenceInput.fill('815');
      await conferenceInput.press('Enter');
      await page.waitForTimeout(3000);

      // Verificar se valor ainda aparece na tabela bancária
      const stillVisible = await page.isVisible('text=815,00');
      console.log(`❌ PROBLEMA: Valor 815,00 ainda visível após transferência: ${stillVisible}`);

      if (stillVisible) {
        console.log('🔍 DEBUGGING: Valor não foi removido da tabela!');

        // Verificar estado do transferredIds após transferência
        const newTransferredIds = await page.evaluate(() => {
          return window.localStorage.getItem('dashboard_transferred_ids');
        });
        console.log('🔍 transferredIds após transferência:', newTransferredIds);

        // Capturar screenshot do problema
        await page.screenshot({ path: 'debug-transfer-problem.png', fullPage: true });
      } else {
        console.log('✅ Transferência funcionou corretamente!');
      }

      // Verificar na aba Conferência de Caixa
      await page.click('text=Conferência de Caixa');
      await page.waitForTimeout(2000);

      const inConference = await page.isVisible('text=815,00');
      console.log(`Valor 815,00 na Conferência de Caixa: ${inConference}`);
    } else {
      console.log('❌ Dados simulados não apareceram na tabela');
      await page.screenshot({ path: 'debug-no-data-loaded.png', fullPage: true });
    }
  });
});