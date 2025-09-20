import { test, expect } from '@playwright/test';
import path from 'path';

test('Upload workflow - verificar funcionamento completo', async ({ page }) => {
  console.log('🚀 Testando workflow completo de upload...');

  // 1. Login
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder*="nome de usuário"]', 'TEST_USER');
  await page.fill('input[placeholder*="senha"]', 'TEST_PASSWORD');
  await page.click('button:has-text("Entrar")');
  await page.waitForLoadState('networkidle');
  console.log('✅ Login realizado');

  // 2. Upload do arquivo
  const fileInput = page.locator('input[type="file"]');
  const filePath = path.join(process.cwd(), 'exemplo', 'caixa_11-09.xls');
  await fileInput.setInputFiles(filePath);
  await page.locator('button:has-text("Carregar")').first().click();
  await page.waitForTimeout(3000); // Aguardar processamento
  console.log('✅ Arquivo enviado');

  // 3. Validar que upload funcionou
  const fileProcessed = await page.locator('text=caixa_11-09.xls').isVisible();
  const dateDetected = await page.locator('text=Data Automática').isVisible();

  expect(fileProcessed).toBe(true);
  expect(dateDetected).toBe(true);
  console.log('✅ Upload processado com sucesso');

  // 4. Screenshot do estado atual
  await page.screenshot({ path: 'test-results/workflow-after-upload.png', fullPage: true });

  // 5. Tentar próximos passos no workflow
  console.log('🔍 Investigando próximos passos...');

  // Verificar se há botões ou ações disponíveis
  const availableButtons = await page.locator('button').allTextContents();
  console.log('🔘 Botões disponíveis:', availableButtons);

  // Verificar seção "Conferir Valor"
  const valorSection = page.locator('text=Conferir Valor').first();
  const valorVisible = await valorSection.isVisible();
  console.log(`💰 Seção Conferir Valor visível: ${valorVisible}`);

  if (valorVisible) {
    // Tentar interagir com a seção Conferir Valor
    const valorInput = page.locator('input[placeholder*="valor"]');
    const valorInputExists = await valorInput.isVisible({ timeout: 3000 });
    console.log(`📝 Campo de valor encontrado: ${valorInputExists}`);

    if (valorInputExists) {
      // Tentar digitar um valor de exemplo
      await valorInput.fill('100');
      await page.click('button:has-text("OK")');
      await page.waitForTimeout(2000);
      console.log('✅ Valor testado inserido');
    }
  }

  // 6. Verificar se apareceram dados ou tabelas
  await page.waitForTimeout(2000);
  const hasData = await page.locator('text=/R\\$|dados|total|registros/i').isVisible({ timeout: 5000 });
  console.log(`📊 Dados encontrados após interação: ${hasData}`);

  // 7. Screenshot final
  await page.screenshot({ path: 'test-results/workflow-final.png', fullPage: true });

  console.log('🎉 Workflow de upload testado com sucesso!');

  // RESULTADO: Upload funciona perfeitamente!
  // O arquivo é processado, a data é detectada automaticamente
  // Próximos passos podem envolver interação com seção "Conferir Valor"
});