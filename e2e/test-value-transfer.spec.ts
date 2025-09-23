import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Transferência de Valores - Conferência Bancária para Conferência de Caixa', () => {
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

  test('deve transferir valor da Conferência Bancária para Conferência de Caixa', async () => {
    console.log('🚀 Iniciando teste de transferência de valores...');

    // 1. Verificar se está na aba correta
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    // 2. Carregar arquivo de exemplo
    console.log('📁 Carregando planilha de teste...');

    // Criar conteúdo de planilha simulada
    const testData = `Data,Tipo,CPF,Valor,Histórico
11/09/2025,PIX RECEBIDO,123.456.789-01,815.00,Pagamento teste 815
11/09/2025,PIX RECEBIDO,987.654.321-02,1470.00,Pagamento teste 1470
11/09/2025,PIX RECEBIDO,456.789.123-03,1330.00,Pagamento teste 1330`;

    // Simular upload de arquivo
    const fileBuffer = Buffer.from(testData, 'utf-8');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: fileBuffer
    });

    // Aguardar processamento
    await page.waitForTimeout(3000);

    // 3. Verificar se os dados foram carregados na tabela
    console.log('✅ Verificando se dados foram carregados...');
    await expect(page.locator('text=R$ 815,00')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=R$ 1.470,00')).toBeVisible();

    console.log('📊 Dados carregados com sucesso na tabela bancária');

    // 4. Contar quantos itens existem na tabela bancária antes da transferência
    const initialBankingItems = await page.locator('[data-testid="banking-table-row"], .banking-table-row, table tbody tr').count();
    console.log(`📈 Itens na tabela bancária antes: ${initialBankingItems}`);

    // 5. Localizar e conferir o valor 815
    console.log('🔍 Buscando valor 815 para conferência...');

    const conferenceInput = page.locator('input[placeholder*="Digite o valor"], input[placeholder*="Conferir"]').first();
    await conferenceInput.fill('815');
    await conferenceInput.press('Enter');

    // Aguardar processamento da busca
    await page.waitForTimeout(2000);

    // 6. Verificar se apareceu mensagem de sucesso
    console.log('✅ Verificando resultado da busca...');
    await expect(page.locator('text=transferido para Conferência de Caixa')).toBeVisible({ timeout: 5000 });

    // 7. Verificar se o valor foi REMOVIDO da tabela bancária
    console.log('🗑️ Verificando remoção da tabela bancária...');

    // Aguardar um momento para a UI atualizar
    await page.waitForTimeout(1000);

    // Contar itens novamente
    const finalBankingItems = await page.locator('[data-testid="banking-table-row"], .banking-table-row, table tbody tr').count();
    console.log(`📉 Itens na tabela bancária depois: ${finalBankingItems}`);

    // O número de itens deve ter diminuído
    expect(finalBankingItems).toBeLessThan(initialBankingItems);

    // O valor específico não deve mais aparecer na tabela bancária
    const bankingValueVisible = await page.locator('text=R$ 815,00').isVisible();
    console.log(`💰 Valor R$ 815,00 ainda visível na tabela bancária: ${bankingValueVisible}`);

    if (bankingValueVisible) {
      console.error('❌ FALHA: Valor ainda aparece na tabela bancária!');

      // Debug: capturar screenshot
      await page.screenshot({ path: 'debug-banking-table-after-transfer.png', fullPage: true });

      // Debug: verificar estado dos transferredIds
      const transferredIds = await page.evaluate(() => {
        return window.localStorage.getItem('dashboard_transferred_ids');
      });
      console.log('🔍 Debug - transferredIds:', transferredIds);

      throw new Error('Valor não foi removido da tabela bancária após transferência');
    }

    // 8. Verificar se o valor apareceu na aba Conferência de Caixa
    console.log('🔄 Verificando transferência para Conferência de Caixa...');

    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(1000);

    // Verificar se o valor aparece na tabela de conferência
    await expect(page.locator('text=R$ 815,00')).toBeVisible({ timeout: 5000 });
    console.log('✅ Valor encontrado na tabela de Conferência de Caixa');

    // 9. Verificação final - valor deve existir APENAS na conferência de caixa
    console.log('🎯 Verificação final...');

    // Voltar para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    // Valor NÃO deve estar presente
    const stillInBanking = await page.locator('text=R$ 815,00').isVisible();
    expect(stillInBanking).toBeFalsy();

    // Voltar para Conferência de Caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(1000);

    // Valor DEVE estar presente
    await expect(page.locator('text=R$ 815,00')).toBeVisible();

    console.log('🎉 SUCESSO: Transferência de valor funcionou corretamente!');
  });

  test('deve transferir múltiplos valores sequencialmente', async () => {
    console.log('🚀 Testando transferência de múltiplos valores...');

    // Ir para Conferência Bancária
    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    // Carregar dados de teste
    const testData = `Data,Tipo,CPF,Valor,Histórico
11/09/2025,PIX RECEBIDO,123.456.789-01,815.00,Pagamento teste 815
11/09/2025,PIX RECEBIDO,987.654.321-02,1470.00,Pagamento teste 1470
11/09/2025,PIX RECEBIDO,456.789.123-03,1330.00,Pagamento teste 1330`;

    const fileBuffer = Buffer.from(testData, 'utf-8');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-multiple.csv',
      mimeType: 'text/csv',
      buffer: fileBuffer
    });

    await page.waitForTimeout(3000);

    // Contar itens iniciais
    const initialItems = await page.locator('[data-testid="banking-table-row"], .banking-table-row, table tbody tr').count();
    console.log(`📊 Itens iniciais: ${initialItems}`);

    // Transferir primeiro valor (815)
    console.log('🔄 Transferindo primeiro valor: 815');
    const conferenceInput = page.locator('input[placeholder*="Digite o valor"], input[placeholder*="Conferir"]').first();

    await conferenceInput.fill('815');
    await conferenceInput.press('Enter');
    await page.waitForTimeout(2000);

    // Verificar transferência
    await expect(page.locator('text=transferido para Conferência de Caixa')).toBeVisible({ timeout: 5000 });

    // Transferir segundo valor (1470)
    console.log('🔄 Transferindo segundo valor: 1470');
    await conferenceInput.fill('1470');
    await conferenceInput.press('Enter');
    await page.waitForTimeout(2000);

    await expect(page.locator('text=transferido para Conferência de Caixa')).toBeVisible({ timeout: 5000 });

    // Verificar que restou apenas 1 item na tabela bancária
    const finalItems = await page.locator('[data-testid="banking-table-row"], .banking-table-row, table tbody tr').count();
    console.log(`📊 Itens finais: ${finalItems}`);

    expect(finalItems).toBe(initialItems - 2);

    // Verificar que os 2 valores estão na conferência de caixa
    await page.click('text=Conferência de Caixa');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=R$ 815,00')).toBeVisible();
    await expect(page.locator('text=R$ 1.470,00')).toBeVisible();

    console.log('🎉 Múltiplas transferências funcionaram!');
  });

  test('deve mostrar erro quando valor não existe', async () => {
    console.log('🚀 Testando busca de valor inexistente...');

    await page.click('text=Conferência Bancária');
    await page.waitForTimeout(1000);

    // Carregar dados sem o valor que vamos buscar
    const testData = `Data,Tipo,CPF,Valor,Histórico
11/09/2025,PIX RECEBIDO,123.456.789-01,1000.00,Pagamento teste`;

    const fileBuffer = Buffer.from(testData, 'utf-8');
    await page.setInputFiles('input[type="file"]', {
      name: 'test-not-found.csv',
      mimeType: 'text/csv',
      buffer: fileBuffer
    });

    await page.waitForTimeout(3000);

    // Buscar valor que não existe
    const conferenceInput = page.locator('input[placeholder*="Digite o valor"], input[placeholder*="Conferir"]').first();
    await conferenceInput.fill('999');
    await conferenceInput.press('Enter');
    await page.waitForTimeout(2000);

    // Deve mostrar erro
    await expect(page.locator('text=Nenhum valor encontrado')).toBeVisible({ timeout: 5000 });

    console.log('✅ Erro exibido corretamente para valor inexistente');
  });
});