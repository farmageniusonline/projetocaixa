import { test, expect } from '@playwright/test';
import path from 'path';

test('debug - investigar fluxo de dados após upload', async ({ page }) => {
  console.log('🔍 Investigando por que dados não aparecem...');

  // Interceptar todas as requisições de rede
  page.on('response', response => {
    console.log(`📡 Response: ${response.status()} ${response.url()}`);
  });

  page.on('console', msg => {
    console.log(`🖥️ Console: ${msg.text()}`);
  });

  // Login e upload
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder*="nome de usuário"]', 'admin');
  await page.fill('input[placeholder*="senha"]', 'manipularium');
  await page.click('button:has-text("Entrar")');
  await page.waitForLoadState('networkidle');

  // Upload arquivo
  const fileInput = page.locator('input[type="file"]');
  const filePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');
  await fileInput.setInputFiles(filePath);

  console.log('📁 Arquivo selecionado, clicando Carregar...');
  await page.locator('button:has-text("Carregar")').first().click();

  // Aguardar mais tempo para processamento
  await page.waitForTimeout(5000);

  // Verificar se há dados no IndexedDB
  const hasIndexedDBData = await page.evaluate(async () => {
    try {
      // Tentar acessar IndexedDB
      const request = indexedDB.open('ManipulariumDB');
      return new Promise((resolve) => {
        request.onsuccess = async (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['uploads', 'entries'], 'readonly');

          const uploadsStore = transaction.objectStore('uploads');
          const entriesStore = transaction.objectStore('entries');

          const uploadsCount = await new Promise(r => {
            const countReq = uploadsStore.count();
            countReq.onsuccess = () => r(countReq.result);
          });

          const entriesCount = await new Promise(r => {
            const countReq = entriesStore.count();
            countReq.onsuccess = () => r(countReq.result);
          });

          resolve({ uploads: uploadsCount, entries: entriesCount });
        };
        request.onerror = () => resolve({ error: 'DB access failed' });
      });
    } catch (error) {
      return { error: error.message };
    }
  });

  console.log('🗄️ IndexedDB dados:', hasIndexedDBData);

  // Verificar se há dados em variáveis JavaScript
  const hasStateData = await page.evaluate(() => {
    // Tentar acessar o estado React via window
    if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
      console.log('React detectado');
    }

    // Verificar se há elementos com dados
    const elementsWithData = document.querySelectorAll('[data-*], .data-*, #data-*');
    return {
      reactElements: elementsWithData.length,
      hasDataAttributes: Array.from(elementsWithData).map(el => el.outerHTML.substring(0, 100))
    };
  });

  console.log('⚛️ Estado da aplicação:', hasStateData);

  // Verificar se precisa navegar para outra aba ou seção
  const tabs = ['Lançamentos', 'Conferência Bancária', 'Conferência de Caixa'];

  for (const tab of tabs) {
    console.log(`🗂️ Testando aba: ${tab}`);
    await page.click(`text=${tab}`);
    await page.waitForTimeout(2000);

    // Procurar por dados nesta aba
    const hasDataInTab = await page.locator('text=/R\\$|\\d{2}/\\d{2}/\\d{4}|CPF|valor/i').count();
    console.log(`📊 Dados encontrados em ${tab}: ${hasDataInTab}`);

    if (hasDataInTab > 0) {
      await page.screenshot({ path: `test-results/dados-em-${tab.toLowerCase().replace(/\s+/g, '-')}.png`, fullPage: true });
      console.log(`📸 Screenshot salvo para ${tab}`);
    }
  }

  // Verificar o que acontece quando digitamos um valor na seção Conferir Valor
  await page.click('text=Conferência Bancária');
  await page.waitForTimeout(1000);

  // Verificar se o campo de valor está habilitado agora
  const valorField = page.locator('input[placeholder*="valor"]');
  const isEnabled = await valorField.isEnabled();
  console.log(`💰 Campo valor habilitado: ${isEnabled}`);

  if (isEnabled) {
    console.log('🔢 Testando inserção de valor...');
    await valorField.fill('100.50');
    await page.click('button:has-text("OK")');
    await page.waitForTimeout(2000);

    // Verificar se apareceram dados após inserir valor
    const dataAfterValue = await page.locator('text=/dados|resultado|encontrado|match/i').count();
    console.log(`📋 Dados após inserir valor: ${dataAfterValue}`);

    await page.screenshot({ path: 'test-results/apos-inserir-valor.png', fullPage: true });
  }

  console.log('🏁 Investigação do fluxo de dados concluída');
});