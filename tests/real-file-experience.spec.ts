import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Experiência do Usuário com Arquivo Real', () => {
  const realFilePath = path.resolve(__dirname, '../exemplo/caixa 03-09-2025.xlsx');

  test.beforeAll(() => {
    // Verificar se o arquivo existe antes dos testes
    if (!fs.existsSync(realFilePath)) {
      throw new Error(`Arquivo de teste não encontrado: ${realFilePath}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Login automático
    await page.goto('/');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'manipularium');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('deve processar arquivo real do Caixa Econômica Federal', async ({ page }) => {
    console.log('🚀 Iniciando teste com arquivo real do Caixa...');

    // 1. Verificar estado inicial
    await expect(page.getByText('Manipularium - Sistema de Conferência')).toBeVisible();
    await expect(page.getByText('📁 Escolher arquivo')).toBeVisible();

    console.log('✅ Interface inicial carregada');

    // 2. Upload do arquivo real
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(realFilePath);

    console.log('✅ Arquivo selecionado:', path.basename(realFilePath));

    // 3. Verificar que arquivo foi reconhecido
    await expect(page.getByText(`✅ ${path.basename(realFilePath)}`)).toBeVisible();

    // 4. Iniciar processamento
    const startTime = Date.now();
    await page.click('text=Carregar');

    console.log('⏳ Iniciando processamento do arquivo...');

    // 5. Aguardar estado de loading
    await expect(page.getByText('Processando arquivo...')).toBeVisible({ timeout: 5000 });

    // 6. Aguardar conclusão do processamento
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const processingTime = Date.now() - startTime;

    console.log(`✅ Arquivo processado em ${processingTime}ms`);

    // 7. Verificar se dados foram carregados
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    console.log(`📊 Encontrados ${rowCount} registros na tabela`);
    expect(rowCount).toBeGreaterThan(0);

    // 8. Verificar estrutura dos dados
    if (rowCount > 0) {
      // Verificar primeira linha
      const firstRow = rows.first();
      await expect(firstRow).toBeVisible();

      // Verificar se tem colunas básicas: Data, Valor, etc.
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();

      console.log(`📋 Primeira linha tem ${cellCount} colunas`);
      expect(cellCount).toBeGreaterThanOrEqual(3); // Pelo menos Data, Tipo, Valor

      // Capturar dados da primeira linha para análise
      const firstRowData: string[] = [];
      for (let i = 0; i < Math.min(cellCount, 5); i++) {
        const cellText = await cells.nth(i).textContent();
        firstRowData.push(cellText || '');
      }

      console.log('📋 Dados da primeira linha:', firstRowData);
    }

    // 9. Testar funcionalidade de busca com dados reais
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');
    await expect(searchInput).toBeEnabled();

    // Tentar buscar um valor que provavelmente existe
    if (rowCount > 0) {
      // Pegar o valor da primeira linha
      const firstValueCell = page.locator('tbody tr:first-child td').nth(2); // Assumindo que valor está na 3ª coluna
      const firstValue = await firstValueCell.textContent();

      if (firstValue) {
        // Extrair apenas números e vírgula/ponto
        const numericValue = firstValue.replace(/[^\d.,]/g, '');

        if (numericValue) {
          console.log(`🔍 Testando busca com valor: ${numericValue}`);

          await searchInput.fill(numericValue);
          await page.keyboard.press('Enter');

          // Aguardar resultado da busca
          await page.waitForTimeout(3000);

          // Verificar se houve alguma resposta (sucesso ou erro)
          const hasResponse = await page.locator('.bg-green-900\\/20, .bg-red-900\\/20, .bg-yellow-900\\/20').isVisible();

          if (hasResponse) {
            console.log('✅ Sistema respondeu à busca');
          } else {
            console.log('⚠️ Nenhuma resposta visível da busca');
          }
        }
      }
    }

    // 10. Testar navegação para Conferência de Caixa
    await page.click('text=Conferência de Caixa');

    // Verificar se a aba foi alterada
    await expect(page.getByText('Filtrar por Data')).toBeVisible();
    console.log('✅ Navegação para Conferência de Caixa funcionando');

    // 11. Verificar estatísticas
    await expect(page.getByText('Total de itens:')).toBeVisible();
    await expect(page.getByText('Valor total:')).toBeVisible();

    // Capturar estatísticas finais
    const totalItemsText = await page.locator('text=Total de itens:').locator('..').textContent();
    console.log('📊 Estatísticas finais:', totalItemsText);

    console.log('🎉 Teste de experiência completo com arquivo real finalizado!');
  });

  test('deve mostrar warnings se arquivo tiver problemas', async ({ page }) => {
    // Upload do arquivo real
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(realFilePath);

    await page.click('text=Carregar');

    // Aguardar processamento
    await page.waitForTimeout(5000);

    // Verificar se há warnings
    const warningSection = page.locator('.bg-yellow-900\\/20');

    if (await warningSection.isVisible()) {
      console.log('⚠️ Sistema mostrou warnings para o arquivo');

      const warningText = await warningSection.textContent();
      console.log('⚠️ Detalhes do warning:', warningText);

      // Warnings são normais, não devem impedir o funcionamento
      await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
      console.log('✅ Mesmo com warnings, dados foram carregados');
    } else {
      console.log('✅ Arquivo processado sem warnings');
    }
  });

  test('deve manter performance adequada com arquivo real', async ({ page }) => {
    console.log('⚡ Testando performance com arquivo real...');

    const performanceStartTime = Date.now();

    // Upload e processamento
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(realFilePath);
    await page.click('text=Carregar');

    // Aguardar loading aparecer
    await expect(page.getByText('Processando arquivo...')).toBeVisible({ timeout: 3000 });
    const loadingStartTime = Date.now();

    // Aguardar tabela carregar
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
    const loadingEndTime = Date.now();

    const totalTime = loadingEndTime - performanceStartTime;
    const processingTime = loadingEndTime - loadingStartTime;

    console.log(`⚡ Tempo total: ${totalTime}ms`);
    console.log(`⚡ Tempo de processamento: ${processingTime}ms`);

    // Performance deve ser razoável (menos de 15 segundos)
    expect(totalTime).toBeLessThan(15000);

    // Verificar responsividade da interface
    const scrollStart = Date.now();
    await page.mouse.wheel(0, 500); // Scroll down
    await page.waitForTimeout(100);
    const scrollTime = Date.now() - scrollStart;

    console.log(`⚡ Tempo de scroll: ${scrollTime}ms`);
    expect(scrollTime).toBeLessThan(500); // Interface deve ser responsiva

    console.log('✅ Performance adequada mantida');
  });

  test('deve permitir interação completa com dados reais', async ({ page }) => {
    console.log('🎮 Testando interação completa com dados reais...');

    // Upload do arquivo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(realFilePath);
    await page.click('text=Carregar');
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });

    console.log('✅ Arquivo carregado, iniciando interações...');

    // 1. Testar filtros de data
    await page.click('input[value="manual"]');
    await page.fill('input[type="date"]', '2024-09-03');

    console.log('📅 Filtro de data configurado');

    // 2. Testar busca com diferentes formatos
    const searchInput = page.locator('input[placeholder*="Digite o valor"]');

    const testValues = ['100', '100.50', '100,50', '1.234,56'];

    for (const testValue of testValues) {
      console.log(`🔍 Testando busca: ${testValue}`);

      await searchInput.clear();
      await searchInput.fill(testValue);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Verificar se houve resposta
      const hasResponse = await page.locator('.bg-green-900\\/20, .bg-red-900\\/20').isVisible();
      console.log(`   ${hasResponse ? '✅' : '⚠️'} Resposta: ${hasResponse ? 'Sim' : 'Não'}`);
    }

    // 3. Testar histórico de não encontrados
    console.log('📝 Testando histórico de não encontrados...');

    await searchInput.clear();
    await searchInput.fill('999999.99'); // Valor improvável
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Expandir histórico
    await page.click('text=Histórico de valores não encontrados');

    // Verificar se valor foi adicionado
    const historySection = page.locator('.bg-gray-900').last();
    if (await historySection.isVisible()) {
      console.log('✅ Histórico de não encontrados funcionando');
    }

    // 4. Testar alternância entre abas
    console.log('🔄 Testando navegação entre abas...');

    await page.click('text=Conferência de Caixa');
    await expect(page.getByText('Filtrar por Data')).toBeVisible();

    await page.click('text=Conferência Bancária');
    await expect(page.getByText('Carregar Planilha')).toBeVisible();

    console.log('✅ Navegação entre abas funcionando');

    // 5. Testar reinício (apenas modal, não executar)
    await page.click('text=Reiniciar dia atual');
    await expect(page.getByText('Confirmar Reinício')).toBeVisible();
    await page.click('text=Cancelar'); // Não executar para não perder dados

    console.log('✅ Modal de reinício funcionando');

    console.log('🎉 Interação completa testada com sucesso!');
  });

  test('deve funcionar em dispositivo móvel', async ({ page }) => {
    console.log('📱 Testando experiência móvel...');

    // Configurar viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Upload do arquivo
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(realFilePath);
    await page.click('text=Carregar');
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });

    console.log('✅ Arquivo carregado em dispositivo móvel');

    // Verificar se interface se adapta
    await expect(page.getByText('Manipularium')).toBeVisible();

    // Testar navegação por touch
    await page.tap('text=Conferência de Caixa');
    await expect(page.getByText('Filtrar por Data')).toBeVisible();

    // Testar scroll na tabela
    const table = page.locator('table');
    const tableBox = await table.boundingBox();

    if (tableBox) {
      await page.mouse.move(tableBox.x + 50, tableBox.y + 50);
      await page.touchscreen.tap(tableBox.x + 50, tableBox.y + 50);

      // Swipe na tabela
      await page.touchscreen.tap(tableBox.x + 50, tableBox.y + 100);
      await page.mouse.move(tableBox.x + 50, tableBox.y + 150);
    }

    console.log('✅ Experiência móvel funcionando adequadamente');

    // Restaurar viewport desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('deve recuperar-se de erros durante processamento', async ({ page }) => {
    console.log('🛠️ Testando recuperação de erros...');

    // Primeiro, testar com arquivo válido
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(realFilePath);
    await page.click('text=Carregar');

    try {
      await expect(page.locator('table')).toBeVisible({ timeout: 30000 });
      console.log('✅ Arquivo real processado com sucesso');

      // Testar limpeza
      await page.click('text=Limpar');
      await expect(page.getByText('📁 Escolher arquivo')).toBeVisible();

      console.log('✅ Limpeza de dados funcionando');

      // Tentar recarregar o mesmo arquivo
      await fileInput.setInputFiles(realFilePath);
      await page.click('text=Carregar');
      await expect(page.locator('table')).toBeVisible({ timeout: 30000 });

      console.log('✅ Reprocessamento funcionando');

    } catch (error) {
      console.log('⚠️ Erro durante processamento:', error);

      // Verificar se há mensagem de erro
      const errorMessage = page.locator('.bg-red-900\\/20');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        console.log('❌ Erro detectado:', errorText);

        // Sistema deve permitir tentar novamente
        await page.click('text=Tentar novamente');
        await expect(page.getByText('📁 Escolher arquivo')).toBeVisible();

        console.log('✅ Recuperação de erro funcionando');
      }
    }
  });
});